"""API de inferência do ViaAlerta: usa pesos treinados, sem iniciar treinamento."""
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
import asyncio
import logging
import os
import hashlib
import math

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import httpx
import time
from uuid import UUID
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps, UnidentifiedImageError


# Preserva o leitor do Pillow antes do monkey patch do Ultralytics, evitando autoinstalações.
ABRIR_IMAGEM = Image.open
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
import torch

os.environ["YOLO_AUTOINSTALL"] = "False"
from ultralytics import YOLO

PROJETO = Path(__file__).resolve().parent.parent
PESOS = Path(os.getenv("MODEL_PATH", str(PROJETO / "notebooks/treinamentos/buracos_aug_nativo_01/yolo_300ep-3/weights/best.pt"))).expanduser()
CONFIANCA = float(os.getenv("CONFIANCA", "0.25"))
if not math.isfinite(CONFIANCA) or not 0 < CONFIANCA <= 1:
    raise ValueError("CONFIANCA deve estar entre 0 (exclusivo) e 1.")
MAX_BYTES = 8 * 1024 * 1024
MAX_CORPO = MAX_BYTES + 64 * 1024
MAX_PIXELS = 40_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
FORMATOS = {"JPEG", "PNG", "WEBP"}
TIPOS = {"image/jpeg", "image/png", "image/webp"}
logger = logging.getLogger("viaalerta.api")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
autorizacao = HTTPBearer(auto_error=False)
limites_usuario: dict[str, list[float]] = {}



class Deteccao(BaseModel):
    """Uma caixa XYXY em pixels da imagem enviada, não da imagem redimensionada pelo YOLO."""
    class_id: int
    class_name: str
    confidence: float
    bbox: tuple[float, float, float, float]


class RespostaDeteccao(BaseModel):
    detections: list[Deteccao]
    image_width: int
    image_height: int


@asynccontextmanager
async def carregar_modelo(app: FastAPI):

    if not PESOS.is_file():
        raise FileNotFoundError(
            "best.pt treinado não encontrado. Ajuste MODEL_PATH para o checkpoint existente."
        )
    if not SUPABASE_URL.startswith("https://") or not SUPABASE_KEY:
        raise RuntimeError("Configure SUPABASE_URL HTTPS e SUPABASE_PUBLISHABLE_KEY.")
    app.state.modelo = YOLO(str(PESOS))
    if app.state.modelo.task != "detect":
        raise RuntimeError("O checkpoint precisa ser de um modelo YOLO de detecção.")
    app.state.dispositivo = os.getenv("DEVICE") or (0 if torch.cuda.is_available() else "cpu")
    if app.state.dispositivo == "cpu":
        torch.set_num_threads(int(os.getenv("CPU_THREADS", "1")))
    app.state.trava = asyncio.Lock()
    with PESOS.open("rb") as arquivo:
        app.state.model_sha256 = hashlib.file_digest(arquivo, "sha256").hexdigest()

    with Image.new("RGB", (640, 640)) as imagem:
        app.state.modelo.predict(source=imagem, imgsz=640, conf=CONFIANCA,
                                 device=app.state.dispositivo, verbose=False)
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as cliente:
        app.state.auth_http = cliente
        yield
    limites_usuario.clear()
    del app.state.modelo
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


app = FastAPI(title="ViaAlerta — API YOLO11s", version="1.2.0", lifespan=carregar_modelo)


class LimitarUpload:
    """Conta bytes antes do parser multipart, inclusive uploads sem Content-Length."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        tamanho = dict(scope["headers"]).get(b"content-length", b"")
        if tamanho.isdigit() and int(tamanho) > MAX_CORPO:
            return await JSONResponse({"detail": "A imagem deve ter no máximo 8 MB."},
                                      status_code=413)(scope, receive, send)
        total = 0

        async def receber():
            nonlocal total
            mensagem = await receive()
            total += len(mensagem.get("body", b""))
            if total > MAX_CORPO:
                raise HTTPException(413, "A imagem deve ter no máximo 8 MB.")
            return mensagem

        await self.app(scope, receber, send)


app.add_middleware(LimitarUpload)
origens = [
    origem.strip() for origem in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if origem.strip()
]
app.add_middleware(
    CORSMiddleware, allow_origins=origens,
    allow_methods=["GET", "POST"], allow_headers=["Content-Type", "Authorization"],
)


async def exigir_usuario(
    credencial: HTTPAuthorizationCredentials | None = Depends(autorizacao),
) -> str:

    if credencial is None:
        raise HTTPException(401, "Entre na sua conta para analisar uma foto.")
    try:
        resposta = await app.state.auth_http.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {credencial.credentials}"},
        )
    except httpx.HTTPError as erro:
        raise HTTPException(503, "Autenticação indisponível. Tente novamente.") from erro
    if resposta.status_code in (401, 403):
        raise HTTPException(401, "Sessão inválida ou expirada. Entre novamente.")
    if resposta.status_code != 200:
        raise HTTPException(503, "Autenticação indisponível. Tente novamente.")
    try:
        usuario = str(UUID(resposta.json()["id"]))
    except (ValueError, KeyError, TypeError) as erro:
        raise HTTPException(503, "Não foi possível confirmar a sessão.") from erro

    agora = time.monotonic()
    for chave in list(limites_usuario):
        if not limites_usuario[chave] or limites_usuario[chave][-1] <= agora - 60:
            del limites_usuario[chave]
    chamadas = [instante for instante in limites_usuario.get(usuario, []) if instante > agora - 60]
    if len(chamadas) >= 10:
        raise HTTPException(429, "Limite de 10 análises por minuto.", headers={"Retry-After": "60"})
    chamadas.append(agora)
    limites_usuario[usuario] = chamadas
    return usuario


def prever_imagem(conteudo: bytes) -> dict:

    try:
        with ABRIR_IMAGEM(BytesIO(conteudo)) as original:
            if original.format not in FORMATOS:
                raise HTTPException(415, "Envie uma imagem JPG, PNG ou WebP.")
            if original.width * original.height > MAX_PIXELS:
                raise HTTPException(413, "A imagem excede 40 megapixels.")
            imagem = ImageOps.exif_transpose(original).convert("RGB")
            imagem.load()
    except (UnidentifiedImageError, OSError, ValueError) as erro:
        raise HTTPException(400, "Não foi possível abrir a imagem enviada.") from erro
    except Image.DecompressionBombError as erro:
        raise HTTPException(413, "A imagem excede o limite de pixels.") from erro

    try:


        resultado = app.state.modelo.predict(
            source=imagem, imgsz=640, conf=CONFIANCA,
            device=app.state.dispositivo, verbose=False,
        )[0]
        deteccoes = []
        if resultado.boxes is not None:
            caixas = resultado.boxes.cpu()
            for classe, confianca, caixa in zip(
                caixas.cls.tolist(), caixas.conf.tolist(), caixas.xyxy.tolist()
            ):
                classe = int(classe)
                deteccoes.append({
                    "class_id": classe,
                    "class_name": str(resultado.names[classe]),
                    "confidence": float(confianca),
                    "bbox": [float(valor) for valor in caixa],
                })
        return {
            "detections": deteccoes,
            "image_width": imagem.width,
            "image_height": imagem.height,
        }
    finally:
        imagem.close()


@app.get("/health")
def verificar_saude():

    return {"status": "ok", "model": "YOLO11s", "device": str(app.state.dispositivo),
            "model_sha256": app.state.model_sha256}


@app.post("/detect", response_model=RespostaDeteccao)
async def detectar(file: UploadFile = File(...), usuario: str = Depends(exigir_usuario)):


    try:
        if file.content_type not in TIPOS:
            raise HTTPException(415, "Envie uma imagem JPG, PNG ou WebP.")
        conteudo = await file.read(MAX_BYTES + 1)
        if not conteudo:
            raise HTTPException(400, "O arquivo está vazio.")
        if len(conteudo) > MAX_BYTES:
            raise HTTPException(413, "A imagem deve ter no máximo 8 MB.")
        if app.state.trava.locked():
            raise HTTPException(503, "O modelo está ocupado. Tente novamente em instantes.")
        async with app.state.trava:
            try:
                return await run_in_threadpool(prever_imagem, conteudo)
            except HTTPException:
                raise
            except Exception as erro:
                logger.exception("Falha na inferência YOLO")
                raise HTTPException(500, "Falha ao analisar a imagem. Tente novamente.") from erro
    finally:
        await file.close()

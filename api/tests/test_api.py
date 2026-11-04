from pathlib import Path
import importlib.util
from io import BytesIO
import logging
import struct
import sys
import tempfile
import types
from unittest.mock import patch
import zlib

root = Path(__file__).resolve().parents[2]
from fastapi.testclient import TestClient
from PIL import Image
import httpx
from unittest.mock import AsyncMock

spec = importlib.util.spec_from_file_location('viaalerta_api_validacao', root / 'api/app.py')
checks = []

def passed(name):
    checks.append({'teste': name, 'passou': True})
    print('PASS', name)

class Values:
    def __init__(self, values):
        self.values = values
    def tolist(self):
        return self.values

class Boxes:
    cls = Values([0.0])
    conf = Values([0.94])
    xyxy = Values([[120, 85, 280, 230]])
    def cpu(self):
        return self

class Result:
    names = {0: 'buraco'}
    boxes = Boxes()

class FakeYOLO:
    loads = 0
    task = 'detect'
    empty = False
    fail = False
    def __init__(self, path):
        FakeYOLO.loads += 1
    def predict(self, **kwargs):
        assert kwargs['source'].mode == 'RGB'
        if self.fail:
            raise RuntimeError('Detalhe interno que não deve aparecer na resposta')
        result = Result()
        if self.empty:
            result.boxes = None
        return [result]

def main():
    previous_logging = logging.root.manager.disable
    modules = {
        "torch": types.SimpleNamespace(cuda=types.SimpleNamespace(is_available=lambda: False), set_num_threads=lambda _: None),
        "ultralytics": types.SimpleNamespace(YOLO=FakeYOLO),
    }
    try:
        with patch.dict(sys.modules, modules):
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            module.YOLO = FakeYOLO
            module.SUPABASE_URL = 'https://teste.supabase.co'
            module.SUPABASE_KEY = 'sb_publishable_teste'

            image = BytesIO()
            Image.new('RGB', (640, 480), 'gray').save(image, format='JPEG')
            image_bytes = image.getvalue()
            logging.disable(logging.CRITICAL)
            with tempfile.TemporaryDirectory() as temporary:
                module.PESOS = Path(temporary) / 'best.pt'
                try:
                    with TestClient(module.app):
                        raise AssertionError('O servidor não pode iniciar sem checkpoint')
                except FileNotFoundError:
                    assert FakeYOLO.loads == 0
                passed('Sem best.pt, a API recusa iniciar e não carrega pesos pré-treinados de fallback')
                module.PESOS.touch()
                with patch.object(module.torch.cuda, 'is_available', return_value=False):
                    with TestClient(module.app) as client:
                        assert client.get('/health').json()['device'] == 'cpu'
                        assert client.get('/health').json()['model'] == 'YOLO11s'
                        assert len(client.get('/health').json()['model_sha256']) == 64
                        client.get('/health')
                        assert FakeYOLO.loads == 1
                        passed('Modelo carregado uma vez por inicialização; health sem recarregar')
                        module.app.dependency_overrides[module.exigir_usuario] = lambda: 'usuario-teste'
                        response = client.post('/detect' , files={'file': ('foto.jpg', image_bytes, 'image/jpeg')})
                        assert response.status_code == 200, response.text
                        data = response.json()
                        assert data == {'detections': [{'class_id': 0, 'class_name': 'buraco', 'confidence': .94, 'bbox': [120., 85., 280., 230.]}], 'image_width': 640, 'image_height': 480}
                        passed('Multipart file devolve o contrato XYXY esperado pelo web e Android')
                        module.app.state.modelo.empty = True
                        assert client.post('/detect', files={'file': ('foto.jpg', image_bytes, 'image/jpeg')}).json()['detections'] == []
                        module.app.state.modelo.empty = False
                        passed('Resposta sem detecções devolve lista vazia, sem caixas simuladas')
                        assert client.post('/detect', files={'file': ('x.txt', b'x', 'text/plain')}).status_code == 415
                        assert client.post('/detect', files={'file': ('x.jpg', b'corrompido', 'image/jpeg')}).status_code == 400
                        assert client.post('/detect', files={'file': ('x.jpg', b'', 'image/jpeg')}).status_code == 400
                        assert client.post('/detect', files={'file': ('x.jpg', b'x' * (module.MAX_BYTES + 1), 'image/jpeg')}).status_code == 413
                        passed('Rejeita MIME indevido, conteúdo inválido, vazio e arquivo acima de 8 MB')
                        huge = b'x' * (module.MAX_CORPO + 1)
                        assert client.post('/detect', content=huge, headers={'Content-Type': 'image/jpeg', 'Origin': 'http://127.0.0.1:3000'}).status_code == 413

                        response = client.post('/detect', content=iter([huge]), headers={'Content-Type': 'multipart/form-data; boundary=teste'})
                        assert response.status_code == 413, response.text
                        passed('Limita corpo HTTP com e sem Content-Length antes de aceitar upload')
                        png = BytesIO()
                        Image.new('RGB', (1, 1)).save(png, format='PNG')
                        content = bytearray(png.getvalue())
                        content[16:24] = struct.pack('>II', 10000, 5000)
                        content[29:33] = struct.pack('>I', zlib.crc32(content[12:29]) & 0xffffffff)
                        assert client.post('/detect', files={'file': ('grande.png', bytes(content), 'image/png')}).status_code == 413
                        passed('Rejeita cabeçalho de imagem acima de 40 MP antes de descomprimir pixels')
                        exif = Image.Exif()
                        exif[274] = 6
                        oriented = BytesIO()
                        Image.new('RGB', (640, 480)).save(oriented, format='JPEG', exif=exif)
                        data = client.post('/detect', files={'file': ('girada.jpg', oriented.getvalue(), 'image/jpeg')}).json()
                        assert (data['image_width'], data['image_height']) == (480, 640)
                        passed('Respeita orientação EXIF e devolve dimensões orientadas')
                        client.portal.call(module.app.state.trava.acquire)
                        try:
                            assert client.post('/detect', files={'file': ('foto.jpg', image_bytes, 'image/jpeg')}).status_code == 503
                        finally:
                            client.portal.call(module.app.state.trava.release)
                        passed('Modelo ocupado retorna 503 e não inicia inferência concorrente')
                        module.app.state.modelo.fail = True
                        error = client.post('/detect', files={'file': ('foto.jpg', image_bytes, 'image/jpeg')})
                        assert error.status_code == 500 and 'Detalhe interno' not in error.text
                        passed('Falha interna de inferência retorna mensagem HTTP genérica')
                        cors = client.options('/detect', headers={'Origin': 'http://127.0.0.1:3000', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization'})
                        assert cors.headers['access-control-allow-origin'] == 'http://127.0.0.1:3000'
                        assert client.options('/detect', headers={'Origin': 'https://outro.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization'}).status_code == 400
                        passed('CORS permite o web local e recusa origem não configurada')

                        module.app.dependency_overrides.clear()
                        files = {'file': ('foto.jpg', image_bytes, 'image/jpeg')}
                        assert client.post('/detect', files=files).status_code == 401
                        passed('Detecção exige token de sessão')
                        module.app.state.modelo.fail = False
                        headers = {'Authorization': 'Bearer token-teste'}
                        usuario = 'eb367c20-4a16-4ee1-9aa5-283324c36817'
                        auth_mock = AsyncMock(return_value=httpx.Response(200, json={'id': usuario}))
                        with patch.object(module.app.state.auth_http, 'get', auth_mock):
                            for _ in range(10):
                                assert client.post('/detect', files=files, headers=headers).status_code == 200
                            assert client.post('/detect', files=files, headers=headers).status_code == 429
                            auth_mock.assert_awaited()
                            called = auth_mock.call_args
                            assert called.args[0] == 'https://teste.supabase.co/auth/v1/user'
                            assert called.kwargs['headers']['Authorization'] == 'Bearer token-teste'
                        passed('Sessão confirmada no Supabase e limitada a dez chamadas por minuto')
                        with patch.object(module.app.state.auth_http, 'get', AsyncMock(return_value=httpx.Response(401))):
                            assert client.post('/detect', files=files, headers=headers).status_code == 401
                        with patch.object(module.app.state.auth_http, 'get', AsyncMock(side_effect=httpx.ConnectError('offline'))):
                            assert client.post('/detect', files=files, headers=headers).status_code == 503
                        passed('Token rejeitado e falha do Supabase impedem inferência')
            print(f'{len(checks)} verificações HTTP passaram com modelo e autenticação substitutos; sem treinamento.')
    finally:
        logging.disable(previous_logging)


if __name__ == '__main__':
    main()

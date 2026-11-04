"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Upload,
  ScanLine,
  LocateFixed,
  Check,
  ArrowRight,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { DetectionImage } from "@/components/detection/image";
import { useAuth } from "@/components/providers";
import {
  analyzeImage,
  validateImage,
  imageDimensions,
} from "@/lib/api/detection";
import { createOccurrence } from "@/lib/api/occurrences";
import Map from "@/components/map/map";
import type { Analysis } from "@/types";
export default function Register() {
  const { demo } = useAuth();
  const router = useRouter();
  const query = useQueryClient();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [analysis, setAnalysis] = useState<Analysis>();
  const [analyzing, setAnalyzing] = useState(false);
  const [emptyDemo, setEmptyDemo] = useState(false);
  const [point, setPoint] = useState<[number, number]>([-23.552, -46.65]);
  const [confirmed, setConfirmed] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const simulated = demo || !process.env.NEXT_PUBLIC_DETECTION_API_URL;
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function choose(selected?: File) {
    if (!selected) return;
    try {
      validateImage(selected);
      const dimensions = await imageDimensions(selected);
      if (dimensions.width * dimensions.height > 40_000_000)
        throw new Error("Use uma imagem com até 40 megapixels.");
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setAnalysis(undefined);
      setConfirmed(false);
      setChosen(false);
      setConsent(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    try {
      setAnalysis(await analyzeImage(file, demo, emptyDemo));
      toast.success("Análise concluída. Confira o resultado na imagem.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }
  function changePoint(next: [number, number]) {
    setPoint(next);
    setChosen(true);
    setConfirmed(false);
  }
  function locate() {
    if (!navigator.geolocation) {
      toast.error("Geolocalização indisponível. Escolha o local no mapa.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        changePoint([position.coords.latitude, position.coords.longitude]);
        setLocating(false);
        toast.info(
          "Confira se este é o local da fotografia antes de confirmar.",
        );
      },
      () => {
        setLocating(false);
        toast.error(
          "Localização indisponível ou negada. Clique no mapa para escolher o local.",
        );
      },
      { timeout: 12000, enableHighAccuracy: true },
    );
  }
  async function save() {
    if (!file || !analysis || !confirmed || !consent) return;
    setSaving(true);
    try {
      const record = await createOccurrence(
        file,
        analysis,
        ...point,
        notes,
        demo,
      );
      await query.invalidateQueries();
      toast.success(
        record.simulated
          ? "Demonstração salva somente neste navegador."
          : "Ocorrência registrada!",
      );
      if (record.simulated && !demo) {
        toast.info(
          "A análise simulada foi mantida localmente. Entre no modo demonstração para vê-la.",
        );
      } else router.push(`/ocorrencias/${record.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Shell
      title="Registrar uma ocorrência"
      subtitle="Seu olhar é o primeiro passo. Fotografe, confira e compartilhe."
    >
      <div className="steps">
        {["Fotografia", "Análise da imagem", "Localização e envio"].map(
          (label, i) => (
            <div
              className={
                i === 0 || (i === 1 && file) || (i === 2 && analysis)
                  ? "done"
                  : ""
              }
              key={label}
            >
              <span>{i + 1}</span>
              {label}
            </div>
          ),
        )}
      </div>
      <div className="registration-grid">
        <div className="flow-column">
          <section className="panel form-section">
            <div className="step-heading">
              <span>01</span>
              <div>
                <h2>Um retrato do problema</h2>
                <p>Escolha uma foto nítida do buraco e da via ao redor.</p>
              </div>
            </div>
            <div
              className="upload-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!analyzing && !saving) choose(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={27} />
              <strong>
                {file
                  ? file.name
                  : "Arraste uma foto ou escolha do dispositivo"}
              </strong>
              <span>JPG, PNG ou WebP · até 8 MB</span>
              <div className="actions">
                <label className="button button-primary" htmlFor="photo">
                  Escolher imagem
                  <input
                    id="photo"
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={analyzing || saving}
                    onChange={(e) => choose(e.target.files?.[0])}
                  />
                </label>
                <label className="button button-outline" htmlFor="camera">
                  <Camera size={17} /> Usar câmera
                  <input
                    id="camera"
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    disabled={analyzing || saving}
                    onChange={(e) => choose(e.target.files?.[0])}
                  />
                </label>
              </div>
            </div>
            {simulated && (
              <Button
                variant="ghost"
                disabled={analyzing || saving}
                onClick={async () => {
                  try {
                    const response = await fetch("/demo-road.jpg");
                    if (!response.ok)
                      throw new Error("Não foi possível abrir o exemplo.");
                    await choose(
                      new File(
                        [await response.blob()],
                        "exemplo-ilustrativo.jpg",
                        { type: "image/jpeg" },
                      ),
                    );
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Usar foto ilustrativa de exemplo
              </Button>
            )}
            {preview && <DetectionImage src={preview} analysis={analysis} />}
            <div className="analysis-actions">
              <div>
                {simulated && (
                  <>
                    <span className="demo-tag">DETECÇÃO SIMULADA</span>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={emptyDemo}
                        disabled={analyzing || saving}
                        onChange={(e) => {
                          setEmptyDemo(e.target.checked);
                          setAnalysis(undefined);
                        }}
                      />{" "}
                      Simular imagem sem buracos
                    </label>
                  </>
                )}
              </div>
              <Button onClick={analyze} disabled={!file || analyzing || saving}>
                <ScanLine size={17} />
                {analyzing ? "Analisando…" : "Analisar imagem"}
              </Button>
            </div>
            {analysis && (
              <div role="status" className="analysis-result">
                <ShieldCheck size={23} />
                <div>
                  <strong>
                    {analysis.detections.length
                      ? `${analysis.detections.length} possível buraco identificado`
                      : "Nenhum buraco identificado"}
                  </strong>
                  <p>
                    {analysis.simulated
                      ? "Exemplo visual simulado; não é uma previsão do YOLO."
                      : "Detecção da IA. O registro ainda depende da sua confirmação."}{" "}
                    {!analysis.detections.length &&
                      "Você ainda pode registrar a ocorrência após conferir a foto."}
                  </p>
                </div>
              </div>
            )}
          </section>
          <section className="panel form-section">
            <div className="step-heading">
              <span>02</span>
              <div>
                <h2>Onde a foto foi tirada?</h2>
                <p>
                  Clique no mapa ou arraste o marcador até o local exato da
                  ocorrência.
                </p>
              </div>
            </div>
            <div className="location-warning">
              O ponto inicial é apenas uma referência em São Paulo. A
              localização atual pode ser diferente do local da foto.
            </div>
            <Button variant="outline" onClick={locate} disabled={locating}>
              <LocateFixed size={16} />
              {locating ? "Localizando…" : "Usar minha localização atual"}
            </Button>
            <div className="location-map">
              <Map point={point} onPoint={changePoint} />
            </div>
            <div className="coordinate-fields">
              <label>
                Latitude
                <input
                  aria-label="Latitude"
                  type="number"
                  step="any"
                  value={point[0]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && Math.abs(n) <= 90)
                      changePoint([n, point[1]]);
                  }}
                />
              </label>
              <label>
                Longitude
                <input
                  aria-label="Longitude"
                  type="number"
                  step="any"
                  value={point[1]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && Math.abs(n) <= 180)
                      changePoint([point[0], n]);
                  }}
                />
              </label>
            </div>
            <Button
              variant={confirmed ? "default" : "outline"}
              disabled={!chosen || saving}
              onClick={() => setConfirmed(true)}
            >
              <Check size={17} />
              {confirmed
                ? "Localização confirmada"
                : "Confirmar local da fotografia"}
            </Button>
          </section>
        </div>
        <aside className="panel summary-panel">
          <span className="eyebrow">QUASE PRONTO</span>
          <h2>Seu registro, em resumo</h2>
          <p>Confira as informações antes de compartilhar com a comunidade.</p>
          <div className="summary-item">
            <Camera size={18} />
            <div>
              <strong>Fotografia</strong>
              <span>{file ? file.name : "Nenhuma imagem enviada"}</span>
            </div>
            {file && <Check size={16} />}
          </div>
          <div className="summary-item">
            <ScanLine size={18} />
            <div>
              <strong>
                Análise {analysis?.simulated ? "simulada" : "da imagem"}
              </strong>
              <span>
                {analysis
                  ? `${analysis.detections.length} detecção · ${Math.round(Math.max(0, ...analysis.detections.map((d) => d.confidence)) * 100)}% maior confiança`
                  : "Aguardando análise"}
              </span>
            </div>
          </div>
          <div className="summary-item">
            <MapPin size={18} />
            <div>
              <strong>Localização</strong>
              <span>
                {confirmed
                  ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`
                  : "Confirme o ponto no mapa"}
              </span>
            </div>
            {confirmed && <Check size={16} />}
          </div>
          <label className="field">
            Observações <span className="muted">(opcional)</span>
            <textarea
              value={notes}
              maxLength={1000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Um ponto de referência pode ajudar…"
              rows={4}
            />
          </label>
          <small className="muted">
            A data será registrada no envio. Evite nomes, rostos, placas ou
            informações pessoais.
          </small>
          <label className="check-label consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Confirmo o local e autorizo a exibição pública da foto, das
            observações e do ponto da ocorrência.
          </label>
          <Button
            className="w-full"
            disabled={!analysis || !confirmed || !consent || saving}
            onClick={save}
          >
            {saving ? "Registrando…" : "Registrar ocorrência"}
            <ArrowRight size={17} />
          </Button>
          <p className="save-note">
            {simulated
              ? "Demonstração: salva apenas neste navegador."
              : "Sua contribuição ficará disponível no mapa público."}
          </p>
        </aside>
      </div>
    </Shell>
  );
}

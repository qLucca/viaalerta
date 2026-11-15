"use client";
import { currentLocation } from "@/lib/location";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  Circle,
  LocateFixed,
  Upload,
  AlertTriangle,
  ArrowRight,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { DetectionImage } from "@/components/detection/image";
import { useAuth } from "@/components/providers";
import { analyzeImage } from "@/lib/api/detection";
import { listOccurrences } from "@/lib/api/occurrences";
import {
  findNearby,
  registerPhoto,
  supportRecord,
} from "@/lib/api/registration";
import { preparePhoto } from "@/lib/photo";
import {
  missingRegistration,
  problemTypes,
  type ProblemType,
  type RegistrationData,
} from "@/lib/registration";
import { plural } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import Map from "@/components/map/map";
import type { Analysis } from "@/types";

type Form = {
  id: string;
  file?: File;
  preview: string;
  width: number;
  height: number;
  gps?: [number, number];
  analysis?: Analysis;
  analysisError: string;
  processing: boolean;
  preparing: boolean;
  reviewed: boolean;
  answer: boolean | null;
  point?: [number, number];
  confirmed: boolean;
  type: ProblemType;
  notes: string;
  danger: boolean;
  consent: boolean;
  duplicateOverride: boolean;
  error: string;
};
function initialForm(): Form {
  return {
    id: crypto.randomUUID(),
    preview: "",
    width: 0,
    height: 0,
    analysisError: "",
    processing: false,
    preparing: false,
    reviewed: false,
    answer: null,
    confirmed: false,
    type: "buraco",
    notes: "",
    danger: false,
    consent: false,
    duplicateOverride: false,
    error: "",
  };
}

export default function Register() {
  return <RegistrationForm />;
}
function RegistrationForm() {
  const { demo, user } = useAuth(),
    cache = useQueryClient();
  const [f, setForm] = useState<Form>(initialForm),
    [saving, setSaving] = useState(false),
    [locating, setLocating] = useState(false);
  const [success, setSuccess] = useState<{
    id: string;
    simulated: boolean;
  } | null>(null);
  const [accuracy, setAccuracy] = useState<number>();
  const [coordinates, setCoordinates] = useState({
    latitude: "",
    longitude: "",
  });
  const [example, setExample] = useState<"positive" | "negative" | "failure">(
    "positive",
  );
  const [supporting, setSupporting] = useState("");
  const locationGeneration = useRef(0),
    generation = useRef(0),
    sending = useRef(false),
    photoInput = useRef<HTMLInputElement>(null);
  const patch = (values: Partial<Form>) =>
    setForm((previous) => ({ ...previous, ...values }));
  useEffect(
    () => () => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    },
    [f.preview],
  );
  const initial = useQuery({
    queryKey: ["map-initial", demo || !supabase],
    queryFn: () => listOccurrences(demo || !supabase, { limit: 500 }),
    enabled: !!user,
  });
  const nearby = useQuery({
    queryKey: ["nearby", demo, f.point?.[0], f.point?.[1], f.type],
    queryFn: () => findNearby(f.point!, f.type, demo),
    enabled: !!f.point && !!user,
    retry: false,
  });
  const duplicateResolved =
    !!f.point &&
    !nearby.isPending &&
    ((!nearby.error && !nearby.data?.length) || f.duplicateOverride);
  const missing = missingRegistration({
    photo: !!f.file,
    processing: f.processing,
    reviewed: f.reviewed,
    location: !!f.point && f.confirmed,
    duplicatesResolved: duplicateResolved,
    consent: f.consent,
  });
  const currentStep = !f.file ? 0 : !f.reviewed ? 1 : !f.confirmed ? 2 : 3;

  async function runAnalysis(file: File, type: ProblemType, ticket: number) {
    if (type !== "buraco") {
      if (ticket === generation.current)
        patch({ processing: false, analysis: undefined, analysisError: "" });
      return;
    }
    try {
      if (demo && example === "failure")
        throw new Error(
          "Falha de análise simulada. Você pode conferir a foto e continuar.",
        );
      if (!demo && !process.env.NEXT_PUBLIC_DETECTION_API_URL)
        throw new Error(
          "A análise não está disponível. Você pode conferir a foto e continuar.",
        );
      const analysis = await analyzeImage(file, demo, example === "negative");
      if (ticket === generation.current)
        patch({ analysis, processing: false, analysisError: "" });
    } catch (error) {
      if (ticket === generation.current)
        patch({
          analysis: undefined,
          analysisError: (error as Error).message,
          processing: false,
        });
    }
  }
  async function choose(source?: File) {
    if (!source || saving) return;
    const ticket = ++generation.current;
    locationGeneration.current++;
    setLocating(false);
    patch({
      file: undefined,
      preview: "",
      analysis: undefined,
      analysisError: "",
      reviewed: false,
      answer: null,
      processing: true,
      preparing: true,
      confirmed: false,
      point: undefined,
      gps: undefined,
      consent: false,
      duplicateOverride: false,
      error: "",
    });
    setCoordinates({ latitude: "", longitude: "" });
    try {
      const photo = await preparePhoto(source);
      if (ticket !== generation.current) return;
      patch({
        file: photo.file,
        preview: URL.createObjectURL(photo.file),
        width: photo.width,
        height: photo.height,
        gps: photo.gps,
        preparing: false,
      });
      await runAnalysis(photo.file, f.type, ticket);
    } catch (error) {
      if (ticket === generation.current)
        patch({
          error: (error as Error).message,
          processing: false,
          preparing: false,
        });
    }
  }
  function changeType(type: ProblemType) {
    const ticket = ++generation.current;
    patch({
      type,
      analysis: undefined,
      analysisError: "",
      reviewed: false,
      answer: null,
      consent: false,
      duplicateOverride: false,
    });
    if (f.file) {
      patch({ processing: type === "buraco" });
      void runAnalysis(f.file, type, ticket);
    }
  }
  function changePoint(point: [number, number]) {
    setAccuracy(undefined);
    locationGeneration.current++;
    setLocating(false);
    patch({
      point,
      confirmed: false,
      consent: false,
      duplicateOverride: false,
    });
    setCoordinates({ latitude: String(point[0]), longitude: String(point[1]) });
  }
  async function locate() {
    const ticket = ++locationGeneration.current;
    setLocating(true);
    try {
      const fix = await currentLocation();
      if (ticket !== locationGeneration.current) return;
      changePoint(fix.point);
      setAccuracy(fix.accuracy);
    } catch (error) {
      if (ticket === locationGeneration.current)
        toast.error((error as Error).message);
    } finally {
      if (ticket === locationGeneration.current) setLocating(false);
    }
  }
  function useCoordinates() {
    const lat = Number(coordinates.latitude),
      lon = Number(coordinates.longitude);
    if (
      !coordinates.latitude.trim() ||
      !coordinates.longitude.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      toast.error("Informe latitude e longitude válidas.");
      return;
    }
    changePoint([lat, lon]);
  }
  async function save() {
    if (missing || !f.file || !f.point || sending.current) return;
    sending.current = true;
    setSaving(true);
    patch({ error: "" });
    try {
      const analysis = f.analysis || {
        image_width: f.width,
        image_height: f.height,
        detections: [],
        simulated: false,
      };
      const feedback = f.analysis
        ? analysis.detections.length > 0 === f.answer
          ? "confirmed"
          : "corrected"
        : "not_verified";
      const data: RegistrationData = {
        id: f.id,
        latitude: f.point[0],
        longitude: f.point[1],
        description: f.notes,
        problem_type: f.type,
        immediate_danger: f.danger,
        analysis_state: f.analysis
          ? "completed"
          : f.type === "buraco"
            ? "failed"
            : "not_requested",
        ai_feedback: feedback,
        human_has_pothole: f.type === "buraco" ? f.answer : null,
        analysis,
        consent: true,
      };
      const saved = await registerPhoto(f.file, data, demo);
      setSuccess({ id: saved.id, simulated: !!saved.simulated });
      void cache.invalidateQueries();
    } catch (error) {
      patch({ error: (error as Error).message });
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }
  async function support(id: string) {
    setSupporting(id);
    try {
      await supportRecord(id, demo);
      toast.success(
        demo
          ? "Apoio de demonstração salvo neste navegador."
          : "Seu apoio foi registrado.",
      );
      void nearby.refetch();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSupporting("");
    }
  }
  async function share(id: string) {
    try {
      const url = `${location.origin}/ocorrencias/${id}`;
      if (navigator.share)
        await navigator.share({ title: "Registro no ViaAlerta", url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError")
        toast.error(
          "Não foi possível compartilhar. Copie o endereço do registro.",
        );
    }
  }
  if (success)
    return (
      <Shell
        title="Registro enviado"
        subtitle="Confira o resumo e acompanhe o andamento."
      >
        <section
          className="panel form-section registration-success"
          role="status"
        >
          <Check size={32} />
          <h2>Seu registro foi salvo</h2>
          <p>
            Número do registro: <strong>{success.id}</strong>
          </p>
          <p>{problemTypes[f.type]} · Local aproximado</p>
          <p>{f.notes || "Sem observações adicionais."}</p>
          <p>
            {success.simulated
              ? "Demonstração: foto e registro ficam neste navegador. A prefeitura não foi notificada."
              : "O registro está disponível no mapa. Acompanhe esta página para consultar futuras atualizações. O atendimento depende da habilitação e atuação da prefeitura."}
          </p>
          <div className="actions">
            <Button asChild>
              <Link href={`/ocorrencias/${success.id}`}>
                Acompanhar registro <ArrowRight size={16} />
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                generation.current++;
                setForm(initialForm());
                setSuccess(null);
              }}
            >
              Registrar outro
            </Button>
            <Button
              variant="outline"
              disabled={success.simulated}
              title={
                success.simulated
                  ? "Registros de demonstração só existem neste navegador"
                  : "Compartilhar registro"
              }
              onClick={() => share(success.id)}
            >
              <Share2 size={16} />
              Compartilhar
            </Button>
          </div>
        </section>
      </Shell>
    );
  return (
    <Shell
      title="Registrar um problema"
      subtitle="Escolha a foto, confira o resultado e confirme o local antes de enviar."
    >
      <ol className="registration-steps" aria-label="Etapas do registro">
        {["Foto", "Conferir análise", "Local", "Revisar e enviar"].map(
          (label, i) => (
            <li key={label} data-complete={i < currentStep}>
              <a
                href={`#register-step-${i + 1}`}
                aria-current={i === currentStep ? "step" : undefined}
              >
                <span>{i < currentStep ? <Check size={16} /> : i + 1}</span>
                {label}
              </a>
            </li>
          ),
        )}
      </ol>
      {f.error && (
        <div className="alert" role="alert">
          {f.error}
        </div>
      )}
      <div className="registration-grid">
        <div className="flow-column">
          <section className="panel form-section" id="register-step-1">
            <h2>1. Foto do problema</h2>
            <p>
              Escolha uma foto nítida. Evite rostos, placas e informações
              pessoais. Não use o celular ao dirigir.
            </p>
            <div className="field">
              <label htmlFor="registration-type">Tipo de problema</label>
              <select
                id="registration-type"
                value={f.type}
                disabled={saving || f.preparing}
                onChange={(e) => changeType(e.target.value as ProblemType)}
              >
                {Object.entries(problemTypes).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {demo && (
              <div className="field">
                <label htmlFor="registration-example">
                  Resultado de exemplo
                </label>
                <select
                  id="registration-example"
                  value={example}
                  disabled={saving || f.processing}
                  onChange={(e) => {
                    setExample(e.target.value as typeof example);
                    patch({
                      file: undefined,
                      preview: "",
                      analysis: undefined,
                      reviewed: false,
                      confirmed: false,
                      consent: false,
                    });
                  }}
                >
                  <option value="positive">Com sinalização de buraco</option>
                  <option value="negative">Sem sinalização de buraco</option>
                  <option value="failure">Falha da análise</option>
                </select>
              </div>
            )}
            <div
              className="upload-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void choose(e.dataTransfer.files[0]);
              }}
            >
              <Upload size={25} />
              <strong>
                {f.preparing
                  ? "Preparando a foto…"
                  : f.file
                    ? "Foto preparada para envio"
                    : "Arraste a foto ou escolha do dispositivo"}
              </strong>
              <span>
                JPG, PNG ou WebP · original de até 25 MB · reduzida para até
                1600 pixels
              </span>
              <input
                ref={photoInput}
                hidden
                type="file"
                id="registration-photo"
                accept="image/jpeg,image/png,image/webp"
                disabled={saving}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void choose(file);
                }}
              />
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => photoInput.current?.click()}
              >
                <Camera size={17} />
                {f.file ? "Trocar foto" : "Escolher foto"}
              </Button>
            </div>
            {demo && (
              <Button
                variant="ghost"
                disabled={saving || f.processing}
                onClick={async () => {
                  try {
                    const response = await fetch("/demo-road.jpg");
                    if (!response.ok) throw new Error("Exemplo indisponível.");
                    void choose(
                      new File([await response.blob()], "exemplo.jpg", {
                        type: "image/jpeg",
                      }),
                    );
                  } catch (error) {
                    patch({ error: (error as Error).message });
                  }
                }}
              >
                Usar foto ilustrativa de exemplo
              </Button>
            )}
            {f.preview && (
              <DetectionImage
                src={f.preview}
                analysis={f.analysis}
                showConfidence={false}
              />
            )}
          </section>
          <section className="panel form-section" id="register-step-2">
            <h2>2. Conferir a foto e a análise</h2>
            {!f.file && !f.processing ? (
              <p>Escolha uma foto na etapa 1 para continuar.</p>
            ) : f.processing ? (
              <p role="status">
                {f.preparing
                  ? "Reduzindo a foto e removendo metadados…"
                  : "Analisando a imagem. Aguarde…"}
              </p>
            ) : (
              <>
                {f.analysis?.simulated && (
                  <p className="demo-tag">
                    Análise simulada: este resultado não é uma previsão real da
                    IA.
                  </p>
                )}
                {f.analysis ? (
                  <>
                    <p className="registration-question">
                      {f.analysis.detections.length
                        ? "Parece haver um buraco aqui. Está certo?"
                        : "A IA não sinalizou um buraco. Você vê um buraco nesta foto?"}
                    </p>
                    <div className="actions">
                      <Button
                        disabled={saving}
                        variant={f.answer === true ? "default" : "outline"}
                        aria-pressed={f.reviewed && f.answer === true}
                        onClick={() =>
                          patch({
                            answer: true,
                            reviewed: true,
                            consent: false,
                          })
                        }
                      >
                        Sim, há um buraco
                      </Button>
                      <Button
                        disabled={saving}
                        variant={f.answer === false ? "default" : "outline"}
                        aria-pressed={f.reviewed && f.answer === false}
                        onClick={() =>
                          patch({
                            answer: false,
                            reviewed: true,
                            consent: false,
                          })
                        }
                      >
                        {f.analysis.detections.length
                          ? "Não, corrigir: não há buraco"
                          : "Não há buraco"}
                      </Button>
                    </div>
                    {f.reviewed && (
                      <p role="status">
                        {f.analysis.detections.length > 0 === f.answer
                          ? "Sua conferência da foto foi registrada."
                          : "Sua correção foi registrada. A indicação da IA não será tratada como confirmação humana."}
                      </p>
                    )}
                    <details className="technical-details">
                      <summary>Detalhes técnicos da análise</summary>
                      <p>
                        {plural(
                          f.analysis.detections.length,
                          "sinalização",
                          "sinalizações",
                        )}{" "}
                        ·{" "}
                        {Math.round(
                          Math.max(
                            0,
                            ...f.analysis.detections.map((d) => d.confidence),
                          ) * 100,
                        )}
                        % de confiança máxima.
                      </p>
                    </details>
                  </>
                ) : (
                  <>
                    <p role={f.analysisError ? "alert" : undefined}>
                      {f.analysisError ||
                        "A IA analisa apenas fotos de buracos. Confira a foto antes de enviar."}
                    </p>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={f.reviewed}
                        disabled={saving}
                        onChange={(e) =>
                          patch({
                            reviewed: e.target.checked,
                            answer: f.type === "buraco" ? true : null,
                            consent: false,
                          })
                        }
                      />
                      Conferi a foto e quero registrar este problema sem
                      verificação da IA.
                    </label>
                    {f.type === "buraco" && (
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => {
                          patch({
                            processing: true,
                            reviewed: false,
                            answer: null,
                          });
                          void runAnalysis(
                            f.file!,
                            f.type,
                            ++generation.current,
                          );
                        }}
                      >
                        Tentar análise novamente
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </section>
          <section className="panel form-section" id="register-step-3">
            <h2>3. Local da foto</h2>
            <p>
              Clique no mapa para marcar onde a foto foi tirada. Sua localização
              atual pode ser diferente do local do problema.
            </p>
            <div className="actions">
              <Button
                variant="outline"
                onClick={locate}
                disabled={locating || saving}
              >
                <LocateFixed size={16} />
                {locating ? "Localizando…" : "Usar minha localização atual"}
              </Button>
              {f.gps && (
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => changePoint(f.gps!)}
                >
                  Usar local da foto (GPS)
                </Button>
              )}
            </div>
            <div className="location-map" aria-busy={saving}>
              <Map
                initialRecords={initial.data}
                initialReady={!initial.isPending}
                point={f.point}
                accuracy={accuracy}
                onPoint={saving ? undefined : changePoint}
              />
            </div>
            <p role="status">
              {f.point
                ? f.confirmed
                  ? "Ponto confirmado"
                  : "Confira o ponto e confirme"
                : "Nenhum local selecionado"}
            </p>
            {f.point && (
              <p>
                {f.point[0].toFixed(6)}, {f.point[1].toFixed(6)}
              </p>
            )}
            {accuracy !== undefined && (
              <p role="status">
                Precisão estimada do GPS: {Math.ceil(accuracy)} m. Confira o
                local da foto e ajuste o marcador se necessário.
              </p>
            )}
            <details className="technical-details">
              <summary>Detalhes técnicos da localização</summary>
              <p>
                Para alterar o local, informe as duas coordenadas e clique em
                Usar coordenadas. O mapa mostra o ponto que será enviado.
              </p>
              <div className="coordinate-fields">
                <label>
                  Latitude
                  <input
                    type="number"
                    step="any"
                    value={coordinates.latitude}
                    disabled={saving}
                    onChange={(e) =>
                      setCoordinates({
                        ...coordinates,
                        latitude: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Longitude
                  <input
                    type="number"
                    step="any"
                    value={coordinates.longitude}
                    disabled={saving}
                    onChange={(e) =>
                      setCoordinates({
                        ...coordinates,
                        longitude: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <Button
                variant="outline"
                disabled={saving}
                onClick={useCoordinates}
              >
                Usar coordenadas
              </Button>
            </details>
            <Button
              variant={f.confirmed ? "default" : "outline"}
              disabled={!f.point || saving}
              onClick={() => patch({ confirmed: true })}
            >
              <Check size={16} />
              {f.confirmed
                ? "Local confirmado"
                : "Confirmar local da fotografia"}
            </Button>
            {f.point && (
              <div className="nearby-records">
                <h3>Alguém já avisou aqui?</h3>
                {nearby.isPending ? (
                  <p role="status">
                    Buscando registros abertos a até 30 metros…
                  </p>
                ) : nearby.error ? (
                  <div role="alert">
                    <p>Não foi possível consultar os registros próximos.</p>
                    <Button variant="outline" onClick={() => nearby.refetch()}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : nearby.data?.length ? (
                  <>
                    <p>
                      Confira se algum destes registros mostra o mesmo problema.
                      Você pode apoiar um registro existente.
                    </p>
                    {nearby.data.map((record) => (
                      <article className="nearby-card" key={record.id}>
                        {/* Foto e distância ajudam a distinguir problemas vizinhos. */}
                        <Image
                          unoptimized
                          src={record.image_url || record.image_path}
                          alt="Foto de um problema próximo"
                          width={96}
                          height={72}
                        />
                        <div>
                          <strong>
                            {problemTypes[record.problem_type || "buraco"]}
                          </strong>
                          <p>
                            A aproximadamente {Math.round(record.distance_m)}{" "}
                            metros ·{" "}
                            {plural(record.support_count || 0, "apoio")}
                          </p>
                          <Link
                            className="text-link"
                            href={`/ocorrencias/${record.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver registro (nova aba)
                          </Link>
                          <Button
                            variant="outline"
                            disabled={!!supporting || saving}
                            onClick={() => support(record.id)}
                          >
                            {supporting === record.id
                              ? "Salvando apoio…"
                              : "Apoiar este registro"}
                          </Button>
                        </div>
                      </article>
                    ))}
                  </>
                ) : (
                  <p>
                    Nenhum registro aberto deste tipo foi encontrado a até 30
                    metros.
                  </p>
                )}
                {(nearby.error || !!nearby.data?.length) && (
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={f.duplicateOverride}
                      disabled={saving || nearby.isPending}
                      onChange={(e) =>
                        patch({
                          duplicateOverride: e.target.checked,
                          consent: false,
                        })
                      }
                    />
                    {nearby.error
                      ? "Quero enviar mesmo sem a consulta de registros próximos."
                      : "É outro problema. Quero criar um novo registro."}
                  </label>
                )}
              </div>
            )}
          </section>
          <section className="panel form-section" id="register-step-4">
            <h2>4. Revisar e enviar</h2>
            <label className="field">
              Observação (opcional)
              <textarea
                value={f.notes}
                rows={4}
                maxLength={1000}
                disabled={saving}
                onChange={(e) =>
                  patch({ notes: e.target.value, consent: false })
                }
                aria-describedby="registration-notes-help"
              />
            </label>
            <p id="registration-notes-help" className="registration-help">
              Descreva um ponto de referência ou uma informação útil. A
              observação aparece nos detalhes; não é o título do registro.{" "}
              {f.notes.length}/1000 caracteres.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={f.danger}
                disabled={saving}
                onChange={(e) =>
                  patch({ danger: e.target.checked, consent: false })
                }
              />
              Oferece perigo imediato?
            </label>
            <p className="registration-help">
              Esta indicação ajuda na triagem e não substitui um serviço de
              emergência.
            </p>
            <label className="check-label consent">
              <input
                type="checkbox"
                checked={f.consent}
                disabled={saving}
                onChange={(e) => patch({ consent: e.target.checked })}
              />
              Concordo que a foto, o local e a observação fiquem públicos no
              mapa.
            </label>
          </section>
        </div>
        <aside
          className="panel summary-panel registration-summary"
          aria-label="Resumo do registro"
        >
          <h2>
            {!f.file
              ? "Falta a foto"
              : !f.reviewed
                ? "Falta conferir a foto"
                : !f.confirmed
                  ? "Falta confirmar o local"
                  : missing
                    ? "Revise antes de enviar"
                    : "Pronto para enviar"}
          </h2>
          <p>
            {problemTypes[f.type]} ·{" "}
            {f.point ? "Local aproximado" : "Local ainda não escolhido"}
          </p>
          <ul className="registration-checklist">
            {[
              [!!f.file, "Foto preparada"],
              [f.reviewed, "Foto e análise conferidas"],
              [f.confirmed, "Local confirmado"],
              [duplicateResolved, "Registros próximos conferidos"],
              [f.consent, "Publicação autorizada"],
            ].map(([ok, label]) => (
              <li key={String(label)}>
                {ok ? <Check size={18} /> : <Circle size={18} />}
                <span>
                  {label}: {ok ? "OK" : "pendente"}
                </span>
              </li>
            ))}
          </ul>
          <p id="registration-missing" role="status">
            {saving
              ? "Enviando o registro. Aguarde…"
              : missing || "Confira o resumo e envie quando estiver pronto."}
          </p>
          <Button
            className="w-full"
            disabled={!!missing || saving}
            onClick={save}
            aria-describedby="registration-missing"
          >
            {saving ? "Enviando…" : "Registrar problema"}
            <ArrowRight size={17} />
          </Button>
          <p className="registration-help">
            {demo
              ? "Demonstração: o envio fica apenas neste navegador."
              : "A foto é publicada sem os metadados originais. Você pode acompanhar o registro após o envio."}
          </p>
          {f.analysisError && (
            <p>
              <AlertTriangle size={16} className="inline" />O registro será
              marcado como não verificado pela IA.
            </p>
          )}
        </aside>
      </div>
    </Shell>
  );
}

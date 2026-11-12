"use client";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, ScanLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { Shell } from "@/components/layout/shell";
import { StatusBadge, Empty } from "@/components/occurrences";
import { DetectionImage } from "@/components/detection/image";
import { getOccurrence } from "@/lib/api/occurrences";
import { dateLabel, plural } from "@/lib/utils";
import Map from "@/components/map/map";
import { supabase } from "@/lib/supabase/client";
import { ReportRecord } from "@/components/report-record";
import { OwnerRecord } from "@/components/owner-record";
import { ProcessPanel } from "@/components/process";
export default function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { demo, loading } = useAuth();
  const {
    data: r,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["occurrence", id, demo || !supabase],
    queryFn: () => getOccurrence(id, demo || !supabase),
    enabled: !loading,
  });
  return (
    <Shell
      title="Detalhes do registro"
      subtitle="Consulte a foto, o local e o status do registro."
      publicMap
    >
      <Link href="/mapa" className="text-link mb-5">
        <ArrowLeft size={16} /> Voltar ao mapa
      </Link>
      {isPending ? (
        <p role="status">Carregando registro…</p>
      ) : error ? (
        <div className="alert" role="alert">
          Não foi possível carregar o registro.{" "}
          <button onClick={() => refetch()}>Tentar novamente</button>
        </div>
      ) : !r ? (
        <Empty
          title="Registro não encontrado."
          description="Confira o endereço ou volte ao mapa."
        />
      ) : (
        <div className="detail-grid">
          <section className="panel form-section">
            <div className="section-heading">
              <StatusBadge status={r.status} />
              <span className="muted">{dateLabel(r.created_at)}</span>
            </div>
            <DetectionImage
              src={r.image_url || r.image_path}
              analysis={
                r.image_width && r.image_height
                  ? {
                      image_width: r.image_width,
                      image_height: r.image_height,
                      detections: r.detections || [],
                      simulated: !!r.simulated,
                    }
                  : undefined
              }
            />
            <h2 className="mt-5">Observações do registro</h2>
            <p>{r.description || "Sem observações adicionais."}</p>
            <div className="analysis-result">
              <ScanLine size={22} />
              <div>
                <strong>
                  {["failed", "not_requested"].includes(
                    r.analysis_state || "",
                  ) ? (
                    "Não verificado pela IA"
                  ) : (
                    <>
                      {plural(r.detection_count, "detecção", "detecções")} ·{" "}
                      {Math.round(r.max_confidence * 100)}% de confiança máxima
                    </>
                  )}
                </strong>
                <p>
                  {r.simulated
                    ? "Resultado de IA e registro simulados."
                    : ["failed", "not_requested"].includes(
                          r.analysis_state || "",
                        )
                      ? "O usuário conferiu a foto e o local. Este registro não foi verificado pela IA."
                      : "A IA sinalizou possíveis buracos. A confirmação ou correção do usuário é registrada separadamente."}
                </p>
              </div>
            </div>
          </section>
          <section className="panel form-section">
            <h2>Local do registro</h2>
            <p className="muted">
              <MapPin size={14} className="inline" /> Local aproximado
            </p>
            <details className="technical-details">
              <summary>Detalhes técnicos da localização</summary>
              <p>
                Latitude: {r.latitude.toFixed(5)} · Longitude:{" "}
                {r.longitude.toFixed(5)}
              </p>
            </details>
            <div className="detail-map">
              <Map point={[r.latitude, r.longitude]} />
            </div>
            <div className="info-box">
              O status representa o acompanhamento administrativo. Uma previsão
              da IA, sozinha, não confirma reparo nem gravidade.
            </div>
          </section>
        </div>
      )}
      {r && (
        <OwnerRecord
          key={r.id + ":" + r.description + ":" + r.cancelled_at}
          record={r}
        />
      )}
      {r && <ReportRecord id={id} />}
      {r && <ProcessPanel id={id} status={r.status} />}
    </Shell>
  );
}

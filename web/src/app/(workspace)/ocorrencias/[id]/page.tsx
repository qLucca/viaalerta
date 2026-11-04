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
import { dateLabel } from "@/lib/utils";
import Map from "@/components/map/map";
import { supabase } from "@/lib/supabase/client";
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
      title="Detalhes da ocorrência"
      subtitle="Uma contribuição para caminhos melhores."
      publicMap
    >
      <Link href="/mapa" className="text-link mb-5">
        <ArrowLeft size={16} /> Voltar ao mapa
      </Link>
      {isPending ? (
        <p role="status">Carregando ocorrência…</p>
      ) : error ? (
        <div className="alert" role="alert">
          Não foi possível carregar a ocorrência.{" "}
          <button onClick={() => refetch()}>Tentar novamente</button>
        </div>
      ) : !r ? (
        <Empty
          title="Ocorrência não encontrada."
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
                  {r.detection_count} detecção ·{" "}
                  {Math.round(r.max_confidence * 100)}% de confiança máxima
                </strong>
                <p>
                  {r.simulated
                    ? "Resultado de IA e ocorrência simulados."
                    : "A IA sinalizou possíveis buracos. O usuário confirmou o registro e a localização."}
                </p>
              </div>
            </div>
          </section>
          <section className="panel form-section">
            <h2>Local da ocorrência</h2>
            <p className="muted">
              <MapPin size={14} className="inline" /> {r.latitude.toFixed(5)},{" "}
              {r.longitude.toFixed(5)}
            </p>
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
    </Shell>
  );
}

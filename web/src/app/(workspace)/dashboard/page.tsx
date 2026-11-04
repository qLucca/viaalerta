"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Clock3,
  ScanLine,
  Check,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { useAuth } from "@/components/providers";
import { listOccurrences, occurrenceSummary } from "@/lib/api/occurrences";
import Map from "@/components/map/map";
import { RecordCard, Empty } from "@/components/occurrences";
export default function Dashboard() {
  const { demo, user } = useAuth();
  const {
    data: result,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["occurrences", demo],
    queryFn: async () => {
      const [records, summary] = await Promise.all([
        listOccurrences(demo, { limit: 100 }),
        occurrenceSummary(demo),
      ]);
      return { records, summary };
    },
    enabled: !!user,
  });
  const data = result?.records || [];
  const summary = result?.summary || {
    total: 0,
    pendente: 0,
    em_analise: 0,
    resolvido: 0,
  };
  const stats = [
    {
      label: "Ocorrências registradas",
      value: summary.total,
      icon: MapPin,
      note: "No mapa colaborativo",
      color: "green",
    },
    {
      label: "Reportadas",
      value: summary.pendente,
      icon: Clock3,
      note: "Aguardando análise",
      color: "red",
    },
    {
      label: "Em análise",
      value: summary.em_analise,
      icon: ScanLine,
      note: "Em acompanhamento",
      color: "orange",
    },
    {
      label: "Resolvidas",
      value: summary.resolvido,
      icon: Check,
      note: "Caminhos mais seguros",
      color: "green",
    },
  ];
  return (
    <Shell
      title="Visão geral"
      subtitle={`Olá, ${user?.name.split(" ")[0] || "colaborador"}. Seu olhar pode transformar o caminho de muita gente.`}
    >
      {error && (
        <div role="alert" className="alert">
          Não foi possível carregar os registros.{" "}
          <button onClick={() => refetch()}>Tentar novamente</button>
        </div>
      )}
      <div className="stat-grid">
        {stats.map(({ label, value, icon: Icon, note, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">
              {label}
              <span className={`stat-icon ${color}`}>
                <Icon size={18} />
              </span>
            </div>
            <strong>{isPending ? "—" : value.toLocaleString("pt-BR")}</strong>
            <div className="stat-note">{note}</div>
          </div>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel map-panel">
          <div className="section-heading">
            <div>
              <h2>Um mapa. Muitas possibilidades.</h2>
              <p>Veja o que está acontecendo nas ruas.</p>
            </div>
            <Link href="/mapa" className="text-link">
              Explorar mapa <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="dashboard-map">
            <Map records={data} />
            <div className="map-place">
              <MapPin size={15} /> São Paulo, SP <span>Visão inicial</span>
            </div>
          </div>
          <div className="map-legend">
            <span>
              <i className="red" /> Reportado
            </span>
            <span>
              <i className="orange" /> Em análise
            </span>
            <span>
              <i className="green" /> Resolvido
            </span>
          </div>
        </section>
        <aside className="contribute-card">
          <span className="contribute-icon">
            <MapPin size={25} />
          </span>
          <div className="eyebrow">SUA CIDADE CONTA COM VOCÊ</div>
          <h2>
            Viu um buraco?
            <br />
            Mostre o caminho.
          </h2>
          <p>
            Uma foto e alguns segundos podem ajudar a tornar nossas ruas mais
            seguras.
          </p>
          <Link href="/registrar">
            Registrar uma ocorrência <ArrowRight size={19} />
          </Link>
          <div className="road-art">
            <span />
            <span />
            <span />
          </div>
          <small>
            Fotografe com segurança. Nunca use o celular ao dirigir.
          </small>
        </aside>
      </div>
      <section>
        <div className="section-heading recent-heading">
          <div>
            <h2>Os últimos olhares pela cidade</h2>
            <p>
              Registros recentes da comunidade{demo ? " · dados simulados" : ""}
              .
            </p>
          </div>
          <Link href="/mapa" className="text-link">
            Ver no mapa <ArrowRight size={16} />
          </Link>
        </div>
        {isPending ? (
          <p aria-live="polite">Carregando ocorrências…</p>
        ) : data.length ? (
          <div className="record-grid">
            {data.slice(0, 3).map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </Shell>
  );
}

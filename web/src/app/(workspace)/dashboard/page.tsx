"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock3, ScanLine, Check, ArrowUpRight } from "lucide-react";
import { Shell } from "@/components/layout/shell";
import { useAuth } from "@/components/providers";
import { listOccurrences, occurrenceSummary } from "@/lib/api/occurrences";
import Map from "@/components/map/map";
import { RecordCard, Empty } from "@/components/occurrences";
export default function Dashboard() {
  const { demo, user } = useAuth();
  const mine = useQuery({
    queryKey: ["dashboard-mine", user?.id, demo],
    enabled: !!user,
    queryFn: async () => {
      const [records, summary] = await Promise.all([
        listOccurrences(demo, { mine: true, limit: 3 }),
        occurrenceSummary(demo, { mine: true }),
      ]);
      return { records, summary };
    },
  });
  const community = useQuery({
    queryKey: ["dashboard-community", demo],
    enabled: !!user,
    queryFn: async () => {
      const [records, summary] = await Promise.all([
        listOccurrences(demo, { limit: 500 }),
        occurrenceSummary(demo),
      ]);
      return { records, summary };
    },
  });
  const summary = mine.data?.summary;
  const cards = [
    {
      label: "Todos os meus registros",
      value: summary?.total,
      status: "",
      icon: MapPin,
    },
    {
      label: "Reportados",
      value: summary?.pendente,
      status: "pendente",
      icon: Clock3,
    },
    {
      label: "Em análise",
      value: summary?.em_analise,
      status: "em_analise",
      icon: ScanLine,
    },
    {
      label: "Resolvidos",
      value: summary?.resolvido,
      status: "resolvido",
      icon: Check,
    },
  ];
  return (
    <Shell
      title="Visão geral"
      subtitle={`Olá, ${user?.name.split(" ")[0] || "colaborador"}. Acompanhe seus registros e consulte a comunidade.`}
    >
      <section>
        <div className="section-heading">
          <div>
            <h2>Meus registros</h2>
            <p>
              Indicadores da sua conta, sem os cancelados. Os números da
              comunidade aparecem separadamente.
            </p>
          </div>
          <Link className="text-link" href="/ocorrencias">
            Ver meus registros
          </Link>
        </div>
        {mine.error ? (
          <div role="alert">
            Não foi possível carregar seus indicadores.{" "}
            <button onClick={() => mine.refetch()}>Tentar novamente</button>
          </div>
        ) : (
          <div className="stat-grid">
            {cards.map(({ label, value, status, icon: Icon }) => (
              <Link
                key={label}
                className="stat-card"
                href={`/ocorrencias${status ? `?status=${status}` : ""}`}
              >
                <div className="stat-label">
                  {label}
                  <Icon size={19} />
                </div>
                <strong>
                  {mine.isPending ? "—" : (value || 0).toLocaleString("pt-BR")}
                </strong>
                <span>Consultar registros</span>
              </Link>
            ))}
          </div>
        )}
        <div className="section-heading recent-heading">
          <h2>Últimos registros da minha conta</h2>
        </div>
        {mine.isPending ? (
          <p role="status">Carregando seus registros…</p>
        ) : mine.data?.records.length ? (
          <div className="record-grid">
            {mine.data.records.map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          !mine.error && (
            <Empty
              title="Você ainda não criou registros."
              description="Use Registrar um problema para enviar sua primeira contribuição."
            />
          )
        )}
      </section>
      <section className="panel map-panel community-panel">
        <div className="section-heading">
          <div>
            <h2>Na comunidade</h2>
            <p>
              {community.isPending
                ? "Carregando totais…"
                : community.error
                  ? "Totais indisponíveis."
                  : `${community.data?.summary.total || 0} registros públicos. Estes números incluem outras pessoas.`}
            </p>
          </div>
          <Link className="text-link" href="/mapa">
            Explorar mapa <ArrowUpRight size={16} />
          </Link>
        </div>
        {community.error ? (
          <div role="alert">
            Não foi possível carregar o mapa.{" "}
            <button onClick={() => community.refetch()}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="dashboard-map">
            <Map
              records={community.data?.records || []}
              initialReady={!community.isPending}
            />
          </div>
        )}
      </section>
    </Shell>
  );
}

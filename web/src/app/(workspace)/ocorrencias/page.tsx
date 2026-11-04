"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { Shell } from "@/components/layout/shell";
import { RecordCard, Empty } from "@/components/occurrences";
import { listOccurrences } from "@/lib/api/occurrences";
import { statusLabels, type Status } from "@/types";
export default function MyRecords() {
  const { demo, user } = useAuth();
  const [status, setStatus] = useState<Status | "">("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);
  const {
    data = [],
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["mine", demo, user?.id, status, sort, page],
    queryFn: () =>
      listOccurrences(demo, {
        mine: true,
        status: status || undefined,
        oldest: sort === "old",
        offset: page * 50,
        limit: 51,
      }),
    enabled: !!user,
  });
  const sorted = data.slice(0, 50);
  return (
    <Shell
      title="Minhas ocorrências"
      subtitle="Acompanhe cada contribuição e o caminho até a melhoria das ruas."
    >
      {demo && (
        <p className="muted mb-4">
          Na demonstração, esta lista inclui os registros de exemplo e os
          criados neste navegador.
        </p>
      )}
      <div className="list-toolbar">
        <label>
          Status{" "}
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as Status | "");
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ordenar{" "}
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(0);
            }}
          >
            <option value="recent">Mais recentes</option>
            <option value="old">Mais antigas</option>
          </select>
        </label>
        <span className="muted">{sorted.length} registros nesta página</span>
      </div>
      {isPending ? (
        <p role="status">Carregando seus registros…</p>
      ) : error ? (
        <div className="alert" role="alert">
          Erro ao carregar.{" "}
          <button onClick={() => refetch()}>Tentar novamente</button>
        </div>
      ) : sorted.length ? (
        <div className="record-grid">
          {sorted.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <Empty
          title="Sua próxima contribuição começa aqui."
          description="Registre uma ocorrência ou altere o filtro para ver seus registros."
        />
      )}
      {!error && (
        <nav className="actions" aria-label="Páginas de ocorrências">
          <button
            className="button button-outline"
            disabled={page === 0 || isPending}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>
          <span>Página {page + 1}</span>
          <button
            className="button button-outline"
            disabled={data.length <= 50 || isPending}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </Shell>
  );
}

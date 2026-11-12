"use client";
import { plural } from "@/lib/format";
import { use, Suspense } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { Shell } from "@/components/layout/shell";
import { RecordCard, Empty } from "@/components/occurrences";
import { listOccurrences } from "@/lib/api/occurrences";
import { statusLabels, type Status } from "@/types";
export default function MyRecords({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<p>Carregando registros…</p>}>
      <Records searchParams={searchParams} />
    </Suspense>
  );
}
function Records({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const requested = use(searchParams).status;
  const { demo, user } = useAuth();
  const [status, setStatus] = useState<Status | "">(
    requested && requested in statusLabels ? (requested as Status) : "",
  );
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
      title="Meus registros"
      subtitle="Consulte seus registros e acompanhe o status."
    >
      {demo && (
        <p className="muted mb-4">
          Na demonstração, esta lista mostra os registros criados por você neste
          navegador. Os exemplos continuam no mapa.
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
        <span className="muted">
          {plural(sorted.length, "registro")} nesta página
        </span>
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
          title="Você ainda não tem registros neste filtro."
          description="Registre um problema ou altere o filtro para ver seus registros."
        />
      )}
      {!error && (page > 0 || data.length > 50) && (
        <nav className="actions" aria-label="Páginas de registros">
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

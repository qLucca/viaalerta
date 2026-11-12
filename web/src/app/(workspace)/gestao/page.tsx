"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Shell } from "@/components/layout/shell";
import { RecordCard, Empty } from "@/components/occurrences";
import { useAuth } from "@/components/providers";
import { useRole } from "@/lib/use-role";
import { listOccurrences } from "@/lib/api/occurrences";
import { accessAction } from "@/lib/api/process";
import { queueCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { statusLabels, type Status } from "@/types";
export default function Management() {
  const { user } = useAuth(),
    { role, staff, needsMfa, pending, error } = useRole();
  const [status, setStatus] = useState<Status | "">(""),
    [page, setPage] = useState(0),
    [exporting, setExporting] = useState(false),
    [message, setMessage] = useState("");
  const records = useQuery({
    queryKey: ["management", user?.id, status, page],
    queryFn: () =>
      listOccurrences(false, {
        staff: true,
        publicOnly: true,
        status: status || undefined,
        offset: page * 50,
        limit: 51,
      }),
    enabled: staff,
    refetchInterval: 30000,
  });
  async function exportCsv() {
    setExporting(true);
    setMessage("");
    try {
      const rows = await accessAction("viaalerta_export_queue"),
        blob = new Blob([queueCsv(rows)], { type: "text/csv;charset=utf-8" }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = "fila-municipal.csv";
      a.click();
      URL.revokeObjectURL(url);
      setMessage(
        "Exportados até 1000 registros ativos autorizados para sua conta.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  return (
    <Shell
      title="Gestão de ocorrências"
      subtitle="Fila de trabalho limitada ao município aprovado para sua conta."
    >
      {pending ? (
        <p role="status">Conferindo acesso…</p>
      ) : needsMfa ? (
        <Link className="text-link" href="/seguranca">
          Verifique sua sessão em duas etapas para acessar a gestão.
        </Link>
      ) : !staff ? (
        <p role="alert">
          {error?.message || "Acesso institucional ainda não aprovado."}
        </p>
      ) : (
        <>
          <p>
            Abra um registro para consultar o local e publicar o andamento.
            Resolver exige foto posterior; rejeitar exige um motivo. As
            previsões podem ser revistas.
          </p>
          <div className="actions">
            {[
              ["", "Todas"],
              ["pendente", "Novas"],
              ["em_analise", "Em análise"],
              ["em_execucao", "Em execução"],
            ].map(([value, label]) => (
              <Button
                variant={status === value ? "default" : "outline"}
                key={value}
                aria-pressed={status === value}
                onClick={() => {
                  setStatus(value as Status | "");
                  setPage(0);
                }}
              >
                {label}
              </Button>
            ))}
            {["manager", "admin"].includes(role) && (
              <Button
                variant="outline"
                disabled={exporting}
                onClick={exportCsv}
              >
                {exporting ? "Exportando…" : "Exportar CSV"}
              </Button>
            )}
          </div>
          <div className="field">
            <label htmlFor="management-status">Filtrar situação</label>
            <select
              id="management-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as Status | "");
                setPage(0);
              }}
            >
              <option value="">Todas</option>
              {Object.entries(statusLabels).map(([s, label]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {records.isPending ? (
            <p role="status">Carregando registros…</p>
          ) : records.error ? (
            <p role="alert">{records.error.message}</p>
          ) : !records.data?.length ? (
            <Empty />
          ) : (
            <div className="record-grid">
              {records.data.slice(0, 50).map((r) => (
                <RecordCard key={r.id} record={r} />
              ))}
            </div>
          )}
          {(page > 0 || (records.data?.length || 0) > 50) && (
            <nav className="actions" aria-label="Páginas da fila">
              <Button
                variant="outline"
                disabled={!page || records.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span>Página {page + 1}</span>
              <Button
                variant="outline"
                disabled={
                  (records.data?.length || 0) <= 50 || records.isFetching
                }
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </nav>
          )}
          {message && <p role="status">{message}</p>}
        </>
      )}
    </Shell>
  );
}

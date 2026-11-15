"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { adminRpc, type AdminReport } from "@/lib/api/admin";
import { reportLabels, reportReasons } from "@/lib/admin";
import { dateLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export function AdminReports() {
  const { user } = useAuth();
  const [state, setState] = useState("pending"),
    [offset, setOffset] = useState(0);
  const reports = useQuery({
    queryKey: ["admin-report-queue", user?.id, state, offset],
    queryFn: () =>
      adminRpc<{ total: number; items: AdminReport[] }>(
        "viaalerta_admin_report_queue",
        { p_state: state, p_offset: offset, p_limit: 20 },
      ),
    refetchInterval: 30000,
    retry: false,
  });
  return (
    <section className="panel form-section stack">
      <h2>Central de denúncias</h2>
      <p>
        Denúncias enviadas nas páginas dos registros chegam a esta fila. A
        identidade do denunciante fica restrita à administração. A quantidade de
        denúncias não comprova infração.
      </p>
      <label className="field">
        Filtrar denúncias
        <select
          value={state}
          onChange={(e) => {
            setState(e.target.value);
            setOffset(0);
          }}
        >
          <option value="all">Todas</option>
          {Object.entries(reportLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {reports.isPending ? (
        <p role="status">Carregando denúncias…</p>
      ) : reports.error ? (
        <p role="alert">{reports.error.message}</p>
      ) : (
        <>
          <p role="status">{reports.data.total} denúncia(s) encontrada(s).</p>
          {reports.data.items.map((report) => (
            <ReportCard
              key={`${report.occurrence_id}:${report.reporter_id}:${report.review_version}`}
              report={report}
            />
          ))}
          {!reports.data.items.length && (
            <p>Nenhuma denúncia nesta situação.</p>
          )}
          <div className="actions">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              Denúncias anteriores
            </Button>
            <Button
              variant="outline"
              disabled={offset + 20 >= reports.data.total}
              onClick={() => setOffset(offset + 20)}
            >
              Próximas denúncias
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
function ReportCard({ report }: { report: AdminReport }) {
  const cache = useQueryClient();
  const [state, setState] = useState("reviewing"),
    [note, setNote] = useState(report.review_note);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act(hide?: boolean) {
    if (note.trim().length < 5) {
      setError("Informe uma justificativa com pelo menos 5 caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (hide !== undefined)
        await adminRpc("viaalerta_moderate_record", {
          p_id: report.occurrence_id,
          p_hide: hide,
          p_reason: note.trim(),
        });
      else
        await adminRpc("viaalerta_admin_review_report", {
          p_occurrence: report.occurrence_id,
          p_reporter: report.reporter_id,
          p_state: state,
          p_note: note.trim(),
          p_version: report.review_version,
        });
      await cache.invalidateQueries();
      toast.success("Análise registrada na auditoria.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="admin-user-card stack">
      <h3>
        {reportReasons[report.reason] || report.reason} ·{" "}
        {reportLabels[report.review_state]}
      </h3>
      <p>{report.description || "Sem observação adicional."}</p>
      <p>
        Recebida em {dateLabel(report.created_at)} · Denunciante:{" "}
        {report.reporter_email}
      </p>
      <p>
        Autor do registro: {report.author_email} · Registro{" "}
        {report.hidden ? "ocultado" : "visível"}
      </p>
      <Link className="text-link" href={`/ocorrencias/${report.occurrence_id}`}>
        Abrir registro denunciado
      </Link>
      <p>
        Para revisar a conta do autor, procure o e-mail acima na gestão de
        usuários.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void act();
        }}
      >
        <label className="field">
          Decisão sobre a denúncia
          <select
            value={state}
            disabled={busy}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="reviewing">Em análise</option>
            <option value="resolved">Resolvida após providência</option>
            <option value="dismissed">Arquivada após revisão</option>
          </select>
        </label>
        <label className="field">
          Justificativa interna
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={note}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <Button disabled={busy}>
          {busy ? "Registrando…" : "Salvar análise da denúncia"}
        </Button>
        <div className="actions">
          <Button
            variant="outline"
            type="button"
            disabled={busy || report.hidden}
            onClick={() => void act(true)}
          >
            Ocultar registro após revisão
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={busy || !report.hidden}
            onClick={() => void act(false)}
          >
            Restaurar registro após revisão
          </Button>
        </div>
        <p>
          Ocultar retira o registro das listas públicas. A foto já compartilhada
          pode continuar acessível pelo endereço direto; para removê-la, é
          necessária uma ação no armazenamento.
        </p>
        {error && <p role="alert">{error}</p>}
      </form>
    </article>
  );
}

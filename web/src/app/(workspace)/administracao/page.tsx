"use client";
import Link from "next/link";
import {roleLabels} from "@/lib/workflow";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/layout/shell";
import { useRole } from "@/lib/use-role";
import { accessAction, listStaff } from "@/lib/api/process";
import { Button } from "@/components/ui/button";
type Request = {
  id: string;
  email: string;
  municipality: string;
  requested_role: string;
  organization: string;
  state: string;
};
type Report = {
  occurrence_id: string;
  reason: string;
  description: string;
  created_at: string;
};
type Audit = {
  id: number;
  action: string;
  entity_id: string;
  created_at: string;
};
export default function Administration() {
  const { role, needsMfa, pending, error: roleError } = useRole(),
    cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const enabled = role === "admin" && !needsMfa;
  const requests = useQuery<Request[]>({
    queryKey: ["access-requests"],
    queryFn: () => accessAction("viaalerta_access_requests"),
    enabled,
  });
  const staff = useQuery({ queryKey: ["staff"], queryFn: listStaff, enabled });
  const reports = useQuery<Report[]>({
    queryKey: ["reports"],
    queryFn: () => accessAction("viaalerta_admin_reports"),
    enabled,
  });
  const audit = useQuery<Audit[]>({
    queryKey: ["audit"],
    queryFn: () => accessAction("viaalerta_admin_audit"),
    enabled,
  });
  async function act(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await accessAction(name, args);
      await cache.invalidateQueries();
      setMessage("Ação registrada na auditoria.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell
      title="Administração"
      subtitle="Aprovação institucional, moderação e auditoria."
    >
      {pending ? (
        <p role="status">Conferindo acesso…</p>
      ) : role !== "admin" ? (
        <p role="alert">
          {roleError?.message || "Acesso restrito ao administrador."}
        </p>
      ) : needsMfa ? (
        <Link className="text-link" href="/seguranca">
          Verifique sua sessão em duas etapas para administrar.
        </Link>
      ) : (
        <div className="stack">
          <section className="panel form-section stack">
            <h2>Solicitações institucionais</h2>
            <p>
              Confira a identidade, o órgão e o município antes de aprovar. A
              solicitação não concede acesso sozinha.
            </p>
            {requests.isPending ? (
              <p>Carregando…</p>
            ) : requests.error ? (
              <p role="alert">{requests.error.message}</p>
            ) : !requests.data?.length ? (
              <p>Nenhuma solicitação recebida.</p>
            ) : (
              requests.data.map((r) => (
                <article key={r.id} className="process-event">
                  <h3>{r.organization}</h3>
                  <p>
                    {r.email} · {r.municipality} ·{" "}
                    {r.requested_role === "manager" ? "Gestor" : "Agente"} ·{" "}
                    {({pending:"Aguardando revisão",approved:"Aprovado",rejected:"Rejeitado"} as Record<string,string>)[r.state]||r.state}
                  </p>
                  {r.state === "pending" && (
                    <div className="actions">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          act("viaalerta_review_access", {
                            p_id: r.id,
                            p_approve: true,
                          })
                        }
                      >
                        Aprovar acesso
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          act("viaalerta_review_access", {
                            p_id: r.id,
                            p_approve: false,
                          })
                        }
                      >
                        Rejeitar solicitação
                      </Button>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
          <section className="panel form-section stack">
            <h2>Equipe autorizada</h2>
            {staff.error && <p role="alert">{staff.error.message}</p>}
            {staff.data?.map((s) => (
              <div key={s.user_id}>
                <span>
                  {s.email} · {roleLabels[s.role]}
                </span>
                {s.role !== "admin" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm("Revogar o acesso institucional desta conta?")
                      )
                        void act("viaalerta_revoke_access", {
                          p_user: s.user_id,
                        });
                    }}
                  >
                    Revogar acesso
                  </Button>
                )}
              </div>
            ))}
          </section>
          <section className="panel form-section stack">
            <h2>Denúncias recentes</h2>
            <p>
              Ocultar retira o registro do mapa e das listas públicas; não apaga
              a foto já compartilhada. Para remover o arquivo, acione o
              responsável pela implantação.
            </p>
            {reports.error ? (
              <p role="alert">{reports.error.message}</p>
            ) : !reports.data?.length ? (
              <p>Nenhuma denúncia recebida.</p>
            ) : (
              reports.data.map((r, i) => (
                <article key={r.occurrence_id + i} className="process-event">
                  <Link
                    className="text-link"
                    href={`/ocorrencias/${r.occurrence_id}`}
                  >
                    Abrir registro
                  </Link>
                  <p>
                    {r.reason} · {r.description}
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const reason = prompt(
                        "Descreva o motivo da ocultação (mínimo 5 caracteres).",
                      );
                      if (reason && reason.trim().length >= 5)
                        void act("viaalerta_moderate_record", {
                          p_id: r.occurrence_id,
                          p_hide: true,
                          p_reason: reason,
                        });
                    }}
                  >
                    Ocultar após revisão
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      act("viaalerta_moderate_record", {
                        p_id: r.occurrence_id,
                        p_hide: false,
                        p_reason:
                          "Registro restaurado após revisão administrativa",
                      })
                    }
                  >
                    Restaurar após revisão
                  </Button>
                </article>
              ))
            )}
          </section>
          <section className="panel form-section stack">
            <h2>Auditoria recente</h2>
            {audit.error ? (
              <p role="alert">{audit.error.message}</p>
            ) : (
              audit.data?.map((a) => (
                <p key={a.id}>
                  {a.created_at} · {a.action} · {a.entity_id}
                </p>
              ))
            )}
          </section>
          {message && <p role="status">{message}</p>}
        </div>
      )}
    </Shell>
  );
}

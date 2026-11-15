"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { adminRpc, type AdminOverview, type AdminUser } from "@/lib/api/admin";
import {
  accountLabels,
  restrictionProblem,
  type AccountState,
} from "@/lib/admin";
import { roleLabels } from "@/lib/workflow";
import { dateLabel } from "@/lib/format";
import { toast } from "sonner";

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [state, setState] = useState("all");
  const [offset, setOffset] = useState(0);
  const { user } = useAuth();
  const stats = useQuery({
    queryKey: ["admin-overview", user?.id],
    queryFn: () => adminRpc<AdminOverview>("viaalerta_admin_overview"),
    refetchInterval: 30000,
    retry: false,
  });
  const users = useQuery({
    queryKey: ["admin-users", user?.id, appliedSearch, state, offset],
    queryFn: () =>
      adminRpc<{ total: number; items: AdminUser[] }>("viaalerta_admin_users", {
        p_search: appliedSearch,
        p_state: state,
        p_offset: offset,
        p_limit: 20,
      }),
    retry: false,
  });
  return (
    <>
      <section className="panel form-section stack">
        <h2>Visão geral dos usuários</h2>
        {stats.error ? (
          <p role="alert">{stats.error.message}</p>
        ) : !stats.data ? (
          <p role="status">Carregando indicadores…</p>
        ) : (
          <dl className="admin-metrics">
            {[
              ["Contas cadastradas", stats.data.users],
              ["E-mails confirmados", stats.data.confirmed_users],
              ["Novas contas em 30 dias", stats.data.new_users_30d],
              ["Contas restritas", stats.data.restricted_users],
              ["Registros enviados", stats.data.occurrences],
              ["Denúncias em aberto", stats.data.pending_reports],
            ].map(([label, count]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <section className="panel form-section stack">
        <h2>Gestão de usuários</h2>
        <p>
          Consulte a atividade e revise cada caso antes de restringir uma conta.
          Denúncias não geram punições automáticas.
        </p>
        <form
          className="admin-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setAppliedSearch(search.trim());
            setOffset(0);
          }}
        >
          <label className="field">
            Buscar por nome ou e-mail
            <input
              type="search"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="field">
            Situação da conta
            <select
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setOffset(0);
              }}
            >
              <option value="all">Todas</option>
              {Object.entries(accountLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button>Buscar usuários</Button>
        </form>
        {users.isPending ? (
          <p role="status">Carregando usuários…</p>
        ) : users.error ? (
          <p role="alert">{users.error.message}</p>
        ) : (
          <>
            <p role="status">{users.data.total} conta(s) encontrada(s).</p>
            {users.data.items.map((item) => (
              <UserCard
                key={`${item.id}:${item.version}`}
                item={item}
                self={item.id === user?.id}
              />
            ))}
            {!users.data.items.length && (
              <p>Nenhum usuário corresponde aos filtros.</p>
            )}
            <div className="actions">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={offset + 20 >= users.data.total}
                onClick={() => setOffset(offset + 20)}
              >
                Próxima
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function UserCard({ item, self }: { item: AdminUser; self: boolean }) {
  const cache = useQueryClient();
  const [action, setAction] = useState<AccountState>(
    item.state === "active" ? "suspended" : "active",
  );
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const problem = restrictionProblem(action, reason, until);
    if (problem || !confirmed) {
      setError(problem || "Confirme a revisão desta conta antes de continuar.");
      return;
    }
    setBusy(true);
    try {
      await adminRpc("viaalerta_admin_restrict_user", {
        p_user: item.id,
        p_state: action,
        p_until: action === "suspended" ? new Date(until).toISOString() : null,
        p_reason: reason.trim(),
        p_version: item.version,
      });
      await cache.invalidateQueries();
      toast.success("Decisão registrada no histórico administrativo.");
      setConfirmed(false);
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="admin-user-card stack">
      <h3>
        {item.name || "Sem nome"}
        {self ? " (sua conta)" : ""}
      </h3>
      <p>
        {item.email} ·{" "}
        {roleLabels[item.role as keyof typeof roleLabels] || "Cidadão"} ·{" "}
        <strong>{accountLabels[item.state]}</strong>
      </p>
      <p>
        {item.occurrences} registro(s) · {item.reports_received} denúncia(s)
        recebida(s) sobre registros · E-mail{" "}
        {item.confirmed ? "confirmado" : "não confirmado"}
      </p>
      <p>
        Cadastro: {dateLabel(item.created_at)} · Último login:{" "}
        {item.last_sign_in_at
          ? dateLabel(item.last_sign_in_at)
          : "Sem login registrado"}
      </p>
      {item.reason && (
        <p>
          Última justificativa: {item.reason}
          {item.state === "suspended" && item.until_at
            ? ` · Até ${dateLabel(item.until_at)}`
            : ""}
        </p>
      )}
      {self ? (
        <p>
          Você não pode suspender ou banir sua própria conta administrativa.
        </p>
      ) : (
        <details>
          <summary>Revisar acesso desta conta</summary>
          <form onSubmit={submit} className="stack">
            <label className="field">
              Ação para {item.email}
              <select
                value={action}
                disabled={busy}
                onChange={(e) => {
                  setAction(e.target.value as AccountState);
                  setConfirmed(false);
                }}
              >
                <option value="suspended">Suspender temporariamente</option>
                <option value="banned">Banir do ViaAlerta</option>
                <option value="active">Remover restrição</option>
              </select>
            </label>
            {action === "suspended" && (
              <label className="field">
                Suspender até (horário local)
                <input
                  type="datetime-local"
                  required
                  disabled={busy}
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                />
              </label>
            )}
            <label className="field">
              Justificativa da decisão
              <textarea
                minLength={5}
                maxLength={1000}
                required
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p>
              A justificativa será exibida à pessoa ao acessar a conta. Evite
              incluir dados de terceiros.
            </p>
            <p>
              A suspensão expira no prazo informado. O banimento não tem prazo e
              pode ser revertido por outro administrador. Os registros e as
              evidências são preservados. A restrição vale para as funções do
              ViaAlerta; não exclui a identidade do Supabase.
            </p>
            <label className="consent-option">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Revisei esta conta e confirmo a ação selecionada.
            </label>
            <Button disabled={busy || !confirmed}>
              {busy ? "Registrando…" : "Confirmar decisão sobre a conta"}
            </Button>
            {error && <p role="alert">{error}</p>}
          </form>
        </details>
      )}
    </article>
  );
}

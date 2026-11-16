import { useState } from "react";
import { View, Switch, Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { adminRpc, type AdminOverview, type AdminUser } from "../lib/admin";
import {
  accountLabels,
  restrictionProblem,
  type AccountState,
} from "../lib/admin-rules";
import { roleLabels } from "../lib/workflow";
import { Card, Txt, Field, Button, Notice, Loading } from "./ui";
import { Choices } from "./Choices";

export function AdminUsers() {
  const { user } = useAuth();
  const [search, setSearch] = useState(""),
    [applied, setApplied] = useState(""),
    [state, setState] = useState("all"),
    [offset, setOffset] = useState(0);
  const stats = useQuery({
    queryKey: ["admin-overview", user?.id],
    queryFn: () => adminRpc<AdminOverview>("viaalerta_admin_overview"),
    retry: false,
    refetchInterval: 30000,
  });
  const list = useQuery({
    queryKey: ["admin-users", user?.id, applied, state, offset],
    queryFn: () =>
      adminRpc<{ total: number; items: AdminUser[] }>("viaalerta_admin_users", {
        p_search: applied,
        p_state: state,
        p_offset: offset,
        p_limit: 20,
      }),
    retry: false,
  });
  return (
    <View style={{ gap: 16 }}>
      <Card style={{ gap: 12 }}>
        <Txt style={{ fontSize: 20, fontWeight: "700" }}>
          Análise de usuários
        </Txt>
        {stats.error ? (
          <Notice error text={stats.error.message} />
        ) : !stats.data ? (
          <Loading />
        ) : (
          (
            [
              ["Contas cadastradas", stats.data.users],
              ["E-mails confirmados", stats.data.confirmed_users],
              ["Novas contas em 30 dias", stats.data.new_users_30d],
              ["Contas restritas", stats.data.restricted_users],
              ["Registros enviados", stats.data.occurrences],
              ["Denúncias em aberto", stats.data.pending_reports],
            ] as const
          ).map(([title, count]) => (
            <Txt key={title}>
              {title}: {count}
            </Txt>
          ))
        )}
      </Card>
      <Card style={{ gap: 14 }}>
        <Txt style={{ fontSize: 20, fontWeight: "700" }}>
          Gestão de usuários
        </Txt>
        <Field
          label="Buscar por nome ou e-mail"
          value={search}
          onChangeText={setSearch}
          maxLength={100}
          autoCapitalize="none"
        />
        <Button
          title="Buscar usuários"
          onPress={() => {
            setApplied(search.trim());
            setOffset(0);
          }}
        />
        <Choices
          label="Situação da conta"
          value={state}
          options={{ all: "Todas", ...accountLabels }}
          onChange={(s) => {
            setState(s);
            setOffset(0);
          }}
        />
        {list.isPending ? (
          <Loading />
        ) : list.error ? (
          <>
            <Notice error text={list.error.message} />
            <Button
              title="Tentar carregar usuários novamente"
              onPress={() => void list.refetch()}
              outline
            />
          </>
        ) : (
          <>
            <Txt>{list.data.total} conta(s) encontrada(s).</Txt>
            {list.data.items.map((item) => (
              <UserCard
                key={`${item.id}:${item.version}`}
                item={item}
                self={item.id === user?.id}
              />
            ))}
            {!list.data.items.length && (
              <Txt>Nenhum usuário corresponde aos filtros.</Txt>
            )}
            <Button
              title="Usuários anteriores"
              disabled={!offset}
              outline
              onPress={() => setOffset(Math.max(0, offset - 20))}
            />
            <Button
              title="Próximos usuários"
              disabled={offset + 20 >= list.data.total}
              outline
              onPress={() => setOffset(offset + 20)}
            />
          </>
        )}
      </Card>
    </View>
  );
}
function UserCard({ item, self }: { item: AdminUser; self: boolean }) {
  const cache = useQueryClient();
  const [expanded, setExpanded] = useState(false),
    [action, setAction] = useState<AccountState>(
      item.state === "active" ? "suspended" : "active",
    ),
    [days, setDays] = useState("7"),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(until: string) {
    setBusy(true);
    setError("");
    try {
      await adminRpc("viaalerta_admin_restrict_user", {
        p_user: item.id,
        p_state: action,
        p_until: action === "suspended" ? until : null,
        p_reason: reason.trim(),
        p_version: item.version,
      });
      setExpanded(false);
      setReason("");
      setConfirmed(false);
      await cache.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function review() {
    const duration = Number(days);
    const until =
      action === "suspended" &&
      Number.isInteger(duration) &&
      duration >= 1 &&
      duration <= 365
        ? new Date(Date.now() + duration * 86400000).toISOString()
        : "";
    const problem = restrictionProblem(action, reason, until);
    if (problem || !confirmed) {
      setError(problem || "Confirme a revisão da conta.");
      return;
    }
    Alert.alert(
      "Confirmar decisão",
      `${accountLabels[action]}: ${item.email}${until ? `\nAté ${new Date(until).toLocaleString("pt-BR")}` : ""}\n${reason.trim()}`,
      [
        { text: "Voltar", style: "cancel" },
        { text: "Confirmar", onPress: () => void save(until) },
      ],
    );
  }
  return (
    <Card style={{ gap: 10 }}>
      <Txt style={{ fontWeight: "700" }}>
        {item.name || "Sem nome"}
        {self ? " (sua conta)" : ""}
      </Txt>
      <Txt>
        {item.email} ·{" "}
        {roleLabels[item.role as keyof typeof roleLabels] || "Cidadão"} ·{" "}
        {accountLabels[item.state]}
      </Txt>
      <Txt>
        {item.occurrences} registro(s) · {item.reports_received} denúncia(s) ·
        E-mail {item.confirmed ? "confirmado" : "não confirmado"}
      </Txt>
      <Txt muted>
        Cadastro: {new Date(item.created_at).toLocaleDateString("pt-BR")} ·
        Último login:{" "}
        {item.last_sign_in_at
          ? new Date(item.last_sign_in_at).toLocaleString("pt-BR")
          : "Não registrado"}
      </Txt>
      {!!item.reason && (
        <Txt>
          Justificativa: {item.reason}
          {item.until_at
            ? ` · Até ${new Date(item.until_at).toLocaleString("pt-BR")}`
            : ""}
        </Txt>
      )}
      {self ? (
        <Txt>Você não pode restringir sua própria conta administrativa.</Txt>
      ) : (
        <Button
          title={
            expanded ? "Fechar revisão da conta" : "Revisar acesso desta conta"
          }
          outline
          disabled={busy}
          onPress={() => setExpanded(!expanded)}
        />
      )}
      {expanded && (
        <>
          <Choices
            label="Decisão"
            value={action}
            options={{
              suspended: "Suspender",
              banned: "Banir",
              active: "Remover restrição",
            }}
            disabled={busy}
            onChange={(s) => {
              setAction(s as AccountState);
              setConfirmed(false);
            }}
          />
          {action === "suspended" && (
            <Field
              label="Suspender por quantos dias? (1 a 365)"
              value={days}
              onChangeText={(v) => {
                setDays(v);
                setConfirmed(false);
              }}
              keyboardType="number-pad"
              maxLength={3}
              editable={!busy}
            />
          )}
          <Field
            label="Justificativa da decisão"
            value={reason}
            onChangeText={(v) => {
              setReason(v);
              setConfirmed(false);
            }}
            multiline
            maxLength={1000}
            editable={!busy}
          />
          <Notice text="A justificativa será exibida à pessoa. O banimento é reversível; os registros são preservados. Denúncias não geram punições automáticas." />
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Switch
              accessibilityLabel="Revisei a conta e confirmo a decisão"
              value={confirmed}
              onValueChange={setConfirmed}
              disabled={busy}
            />
            <View style={{ flex: 1 }}>
              <Txt>Revisei a conta e confirmo a decisão.</Txt>
            </View>
          </View>
          <Button
            title="Confirmar decisão sobre a conta"
            disabled={!confirmed}
            busy={busy}
            onPress={review}
          />
        </>
      )}
      {!!error && <Notice error text={error} />}
    </Card>
  );
}

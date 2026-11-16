import { useState } from "react";
import { View, Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Notice, Loading, Txt } from "./ui";
import { useAuth } from "../providers";
import { adminRpc } from "../lib/admin";
import { auditActionLabels } from "../lib/admin-rules";
import { roleLabels } from "../lib/workflow";
import { listStaff } from "../lib/process";
type AccessRequest = {
  id: string;
  email: string;
  municipality: string;
  requested_role: string;
  organization: string;
  state: string;
};
type Audit = {
  id: number;
  action: string;
  entity_id: string;
  created_at: string;
  actor_email?: string;
  subject_email?: string;
  reason?: string;
};
export function AdminAccess() {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const requests = useQuery({
    queryKey: ["access-requests", user?.id],
    queryFn: () => adminRpc<AccessRequest[]>("viaalerta_access_requests"),
    retry: false,
  });
  const staff = useQuery({
    queryKey: ["staff", user?.id],
    queryFn: listStaff,
    retry: false,
  });
  const audit = useQuery({
    queryKey: ["audit", user?.id],
    queryFn: () => adminRpc<Audit[]>("viaalerta_admin_audit"),
    retry: false,
  });
  async function act(name: string, args: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminRpc(name, args);
      await cache.invalidateQueries();
      setMessage("Ação registrada na auditoria.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 18 }}>
      {!!error && <Notice error text={error} />}{" "}
      {!!message && <Notice text={message} />}
      <Card style={{ gap: 14 }}>
        <Txt style={{ fontWeight: "700", fontSize: 20 }}>
          Solicitações institucionais
        </Txt>
        <Txt>
          Confira identidade, órgão e município antes de aprovar. A solicitação
          não concede acesso sozinha.
        </Txt>
        {requests.isPending ? (
          <Loading />
        ) : requests.error ? (
          <Notice error text={requests.error.message} />
        ) : !requests.data.length ? (
          <Txt>Nenhuma solicitação recebida.</Txt>
        ) : (
          requests.data.map((r) => (
            <Card key={r.id} style={{ gap: 12 }}>
              <Txt>{r.organization}</Txt>
              <Txt>
                {r.email} · {r.municipality} ·{" "}
                {r.requested_role === "manager" ? "Gestor" : "Agente"} ·{" "}
                {(
                  {
                    pending: "Aguardando revisão",
                    approved: "Aprovado",
                    rejected: "Rejeitado",
                  } as Record<string, string>
                )[r.state] || r.state}
              </Txt>
              {r.state === "pending" && (
                <>
                  <Button
                    title="Aprovar acesso"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(
                        "Aprovar acesso institucional",
                        `Confirma a identidade, o vínculo e o município de ${r.email}?`,
                        [
                          { text: "Voltar", style: "cancel" },
                          {
                            text: "Aprovar",
                            onPress: () =>
                              void act("viaalerta_review_access", {
                                p_id: r.id,
                                p_approve: true,
                              }),
                          },
                        ],
                      )
                    }
                  />
                  <Button
                    title="Rejeitar solicitação"
                    outline
                    disabled={busy}
                    onPress={() =>
                      Alert.alert("Rejeitar solicitação", r.email, [
                        { text: "Voltar", style: "cancel" },
                        {
                          text: "Rejeitar",
                          onPress: () =>
                            void act("viaalerta_review_access", {
                              p_id: r.id,
                              p_approve: false,
                            }),
                        },
                      ])
                    }
                  />
                </>
              )}
            </Card>
          ))
        )}{" "}
      </Card>
      <Card style={{ gap: 14 }}>
        <Txt style={{ fontWeight: "700", fontSize: 20 }}>Equipe autorizada</Txt>
        {staff.isPending ? (
          <Loading />
        ) : staff.error ? (
          <Notice error text={staff.error.message} />
        ) : (
          staff.data?.map((s) => (
            <View key={s.user_id} style={{ gap: 10 }}>
              <Txt>
                {s.email} · {roleLabels[s.role]}
              </Txt>
              {s.role !== "admin" && (
                <Button
                  title={`Revogar acesso de ${s.email}`}
                  outline
                  disabled={busy}
                  onPress={() =>
                    Alert.alert("Revogar acesso institucional", s.email, [
                      { text: "Voltar", style: "cancel" },
                      {
                        text: "Revogar",
                        onPress: () =>
                          void act("viaalerta_revoke_access", {
                            p_user: s.user_id,
                          }),
                      },
                    ])
                  }
                />
              )}
            </View>
          ))
        )}
      </Card>
      <Card style={{ gap: 14 }}>
        <Txt style={{ fontWeight: "700", fontSize: 20 }}>Auditoria recente</Txt>
        {audit.isPending ? (
          <Loading />
        ) : audit.error ? (
          <Notice error text={audit.error.message} />
        ) : (
          audit.data?.map((a) => (
            <Txt key={a.id}>
              {new Date(a.created_at).toLocaleString("pt-BR")} ·{" "}
              {auditActionLabels[a.action] || a.action}
              {a.actor_email ? ` · Por ${a.actor_email}` : ""} ·{" "}
              {a.subject_email || a.entity_id}
              {a.reason ? ` · ${a.reason}` : ""}
            </Txt>
          ))
        )}
      </Card>
    </View>
  );
}

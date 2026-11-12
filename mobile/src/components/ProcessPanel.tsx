import { useState } from "react";
import { View, Pressable, Image } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { useRole } from "../lib/use-role";
import {
  processHistory,
  transitions,
  updateProcess,
  processSnapshot,
  recordPermissions,
} from "../lib/process";
import { roleLabels, rejectionReasons, workflowProblem } from "../lib/workflow";
import { pickPhoto, photoBytes } from "../lib/photos";
import { supabase } from "../lib/supabase";
import {
  statusLabels,
  type Status,
  type Occurrence,
  type Photo,
} from "../types";
import { Section, Card, Txt, Badge, Field, Button, Notice } from "./ui";
import { useTheme } from "../theme";
export function ProcessPanel({ id, status }: { id: string; status: Status }) {
  const { user, demo } = useAuth(),
    { staff, needsMfa } = useRole(),
    cache = useQueryClient();
  const history = useQuery({
    queryKey: ["process", id, user?.id],
    queryFn: () => processHistory(id),
    enabled: !demo,
    refetchInterval: 15000,
    retry: false,
  });
  const permissions = useQuery({
    queryKey: ["record-permissions", id, user?.id],
    queryFn: () => recordPermissions(id),
    enabled: staff,
    retry: false,
  });
  const record = useQuery({
    queryKey: ["process-record", id, user?.id],
    queryFn: () => processSnapshot(id),
    enabled: staff && !!permissions.data?.can_manage,
  });
  if (demo) return null;
  const latest = history.data?.at(-1);
  return (
    <>
      <Section title="Acompanhamento da prefeitura" />
      {history.isPending && <Txt>Carregando andamento…</Txt>}
      {history.error && <Notice error text={history.error.message} />}
      {!history.isPending && !history.error && (
        <Card>
          <Badge status={(latest?.status || status) as Status} />
          {!latest && (
            <Txt>
              Aguardando triagem. Ainda não há encaminhamento para análise.
            </Txt>
          )}
          {history.data?.map((item) => (
            <View key={item.id} style={{ marginTop: 20, gap: 8 }}>
              <Badge status={item.status as Status} />
              <Txt muted>
                {new Date(item.created_at).toLocaleString("pt-BR")}
              </Txt>
              <Txt>{item.message}</Txt>
              {item.intervention_date && (
                <Txt>
                  Previsão:{" "}
                  {item.intervention_date.split("-").reverse().join("/")}.
                  Sujeita a atualização.
                </Txt>
              )}
              {item.rejection_reason && (
                <Txt>
                  Motivo:{" "}
                  {rejectionReasons[
                    item.rejection_reason as keyof typeof rejectionReasons
                  ] || item.rejection_reason}
                </Txt>
              )}
              {item.after_image_path && (
                <Image
                  source={{
                    uri: supabase!.storage
                      .from("viaalerta-interventions")
                      .getPublicUrl(item.after_image_path).data.publicUrl,
                  }}
                  style={{ height: 200, width: "100%", borderRadius: 10 }}
                  accessibilityLabel="Foto da intervenção concluída"
                />
              )}
              <Txt muted>
                {roleLabels[item.actor_role as keyof typeof roleLabels] ||
                  "Prefeitura de Uberlândia"}
              </Txt>
            </View>
          ))}
        </Card>
      )}
      {needsMfa && (
        <Card>
          <Notice text="Verifique o autenticador para publicar um andamento." />
          <Button
            title="Verificar segurança"
            onPress={() => router.push("/seguranca")}
          />
        </Card>
      )}
      {(record.error || permissions.error) && (
        <Notice error text={(record.error || permissions.error)!.message} />
      )}
      {staff && permissions.data?.can_manage && record.data && (
        <ProcessForm
          key={`${id}:${record.data.workflow_version}:${record.data.status}`}
          record={record.data}
          date={latest?.intervention_date || ""}
          refresh={() => cache.invalidateQueries()}
        />
      )}
    </>
  );
}
function ProcessForm({
  record,
  date,
  refresh,
}: {
  record: Pick<Occurrence, "id" | "status" | "workflow_version">;
  date: string;
  refresh: () => Promise<void>;
}) {
  const { colors } = useTheme(),
    allowed = transitions[record.status] || [];
  const [status, setStatus] = useState(allowed[0] || "em_analise"),
    [message, setMessage] = useState(""),
    [plannedDate, setDate] = useState(date),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""),
    [related, setRelated] = useState(""),
    [photo, setPhoto] = useState<Photo>(),
    [consent, setConsent] = useState(false);
  async function choose() {
    setError("");
    try {
      const p = await pickPhoto(false);
      if (p) {
        setPhoto(p);
        setConsent(false);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      const problem = workflowProblem(
        record.status,
        status,
        message,
        plannedDate,
        photo ? "foto-selecionada" : "",
        reason,
        related,
      );
      if (problem) throw new Error(problem);
      let after = "";
      if (status === "resolvido") {
        if (!photo || !consent)
          throw new Error(
            "Escolha a foto de conclusão e autorize a publicação.",
          );
        const permission = await recordPermissions(record.id);
        if (!permission.can_manage)
          throw new Error("Você não pode atuar neste registro.");
        const auth = await supabase!.auth.getUser();
        if (!auth.data.user) throw new Error("Entre novamente.");
        after = `${auth.data.user.id}/${record.id}/${Crypto.randomUUID()}.jpg`;
        const upload = await supabase!.storage
          .from("viaalerta-interventions")
          .upload(after, await photoBytes(photo), {
            contentType: "image/jpeg",
            upsert: false,
          });
        if (upload.error)
          throw new Error("Não foi possível enviar a foto de conclusão.");
      }
      await updateProcess(
        record.id,
        record.status,
        status,
        message,
        plannedDate,
        record.workflow_version || 0,
        after,
        reason,
        related,
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section title="Registrar andamento" />
      <Card>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {allowed.map((s) => (
            <Pressable
              key={s}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ selected: status === s }}
              onPress={() => setStatus(s)}
              style={{
                padding: 12,
                borderRadius: 10,
                backgroundColor: status === s ? colors.soft : colors.surface2,
              }}
            >
              <Txt>{statusLabels[s as Status]}</Txt>
            </Pressable>
          ))}
        </View>
        <Field
          label="O que está ocorrendo?"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
          editable={!busy}
        />
        <Field
          label="Previsão de intervenção (AAAA-MM-DD)"
          value={plannedDate}
          onChangeText={setDate}
          maxLength={10}
          editable={!busy}
        />
        {status === "rejeitado" && (
          <View style={{ gap: 12 }}>
            {Object.entries(rejectionReasons).map(([v, label]) => (
              <Pressable
                key={v}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === v }}
                onPress={() => setReason(v)}
              >
                <Txt>
                  {reason === v ? "● " : "○ "}
                  {label}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
        {status === "duplicado" && (
          <Field
            label="Número completo do registro principal"
            value={related}
            onChangeText={setRelated}
            autoCapitalize="none"
            editable={!busy}
          />
        )}
        {status === "resolvido" && (
          <View style={{ gap: 12 }}>
            <Button
              title={
                photo
                  ? "Trocar foto de conclusão"
                  : "Escolher foto de conclusão"
              }
              outline
              onPress={() => void choose()}
              disabled={busy}
            />
            {photo && (
              <Image
                source={{ uri: photo.uri }}
                style={{ height: 180, width: "100%", borderRadius: 10 }}
                accessibilityLabel="Foto de conclusão selecionada"
              />
            )}
            <Pressable
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
              onPress={() => setConsent((v) => !v)}
            >
              <Txt>
                {consent ? "☑ " : "☐ "}Autorizo a publicação da foto, sem
                pessoas identificáveis ou dados pessoais.
              </Txt>
            </Pressable>
          </View>
        )}
        <Notice text="O comentário é público. O cidadão recebe uma notificação no app; e-mail depende do serviço de envio configurado." />
        {!!error && (
          <>
            <Notice error text={error} />
            <Button
              title="Recarregar processo"
              onPress={() => void refresh()}
              outline
            />
          </>
        )}
        <Button
          title="Publicar atualização"
          onPress={() => void save()}
          busy={busy}
        />
      </Card>
    </>
  );
}

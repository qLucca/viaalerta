import { useState } from "react";
import { View, Alert } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { recordPermissions, processError } from "../lib/process";
import { supabase } from "../lib/supabase";
import { reportReasons } from "../lib/admin-rules";
import type { Occurrence } from "../types";
import { Card, Txt, Field, Button, Notice } from "./ui";
import { Choices } from "./Choices";

export function RecordActions({
  record,
  local,
}: {
  record: Occurrence;
  local: boolean;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [note, setNote] = useState(record.description),
    [edit, setEdit] = useState(false),
    [report, setReport] = useState(false),
    [reason, setReason] = useState("dados_pessoais"),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [reported, setReported] = useState(false);
  const permission = useQuery({
    queryKey: ["record-permissions", record.id, user?.id],
    enabled: !!user && !local,
    retry: false,
    queryFn: () => recordPermissions(record.id),
  });
  async function change(cancel: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (note.length > 1000)
        throw Error("Use até 1.000 caracteres na observação.");
      const result = await supabase!.rpc("viaalerta_owner_change", {
        p_id: record.id,
        p_description: note,
        p_cancel: cancel,
        p_version: permission.data?.version,
      });
      if (result.error) throw Error(processError(result.error));
      setMessage(
        cancel
          ? "Registro cancelado e retirado do mapa público."
          : "Observação atualizada.",
      );
      setEdit(false);
      await cache.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function sendReport() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !Object.hasOwn(reportReasons, reason) ||
        description.trim().length > 500 ||
        (reason === "outro" && description.trim().length < 5)
      )
        throw Error(
          "Confira o motivo e os detalhes. Para outro motivo, use pelo menos 5 caracteres.",
        );
      const result = await supabase!.rpc("viaalerta_report_record", {
        p_id: record.id,
        p_reason: reason,
        p_description: description.trim(),
      });
      if (result.error) throw Error(processError(result.error));
      setMessage(
        "Denúncia recebida para revisão. Ela não altera o status automaticamente.",
      );
      setReported(true);
      setReport(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (local) return null;
  return (
    <Card style={{ gap: 14 }}>
      {!!permission.error && (
        <>
          <Notice error text={permission.error.message} />
          <Button
            title="Conferir permissões novamente"
            outline
            onPress={() => void permission.refetch()}
          />
        </>
      )}
      {permission.data?.cancelled ? (
        <Notice text="Registro cancelado pelo autor. Não aparece no mapa público." />
      ) : (
        permission.data?.can_edit && (
          <>
            <Button
              title={edit ? "Fechar edição" : "Editar ou cancelar meu registro"}
              outline
              disabled={busy}
              onPress={() => setEdit(!edit)}
            />
            {edit && (
              <>
                <Txt>
                  Disponível antes do atendimento. A localização e a foto
                  originais são preservadas.
                </Txt>
                <Field
                  label="Observação"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={1000}
                  editable={!busy}
                />
                <Button
                  title="Salvar observação"
                  busy={busy}
                  onPress={() => void change(false)}
                />
                <Button
                  title="Cancelar registro"
                  outline
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      "Cancelar registro?",
                      "Ele sairá do mapa público e ficará disponível em seus registros.",
                      [
                        { text: "Voltar", style: "cancel" },
                        {
                          text: "Cancelar registro",
                          style: "destructive",
                          onPress: () => void change(true),
                        },
                      ],
                    )
                  }
                />
              </>
            )}
          </>
        )
      )}
      <Button
        title={report ? "Fechar denúncia" : "Denunciar registro"}
        outline
        disabled={busy || reported}
        onPress={() => setReport(!report)}
      />
      {report && (
        <View style={{ gap: 14 }}>
          <Txt>
            Avise sobre dados pessoais, conteúdo inadequado ou local incorreto.
            Sua identidade fica restrita à administração.
          </Txt>
          <Choices
            label="Motivo da denúncia"
            value={reason}
            options={reportReasons}
            onChange={setReason}
            disabled={busy}
          />
          <Field
            label={`Detalhes ${reason === "outro" ? "(obrigatório)" : "(opcional)"}`}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            editable={!busy}
          />
          <Button
            title="Enviar denúncia"
            busy={busy}
            onPress={() => void sendReport()}
          />
        </View>
      )}
      {!!error && <Notice error text={error} />}{" "}
      {!!message && <Notice text={message} />}
    </Card>
  );
}

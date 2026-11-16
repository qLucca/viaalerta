import { useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../providers";
import { adminRpc, type AdminReport } from "../lib/admin";
import { reportLabels, reportReasons } from "../lib/admin-rules";
import { Card, Txt, Field, Button, Notice, Loading } from "./ui";
import { Choices } from "./Choices";

export function AdminReports() {
  const { user } = useAuth();
  const [state, setState] = useState("pending"),
    [offset, setOffset] = useState(0);
  const list = useQuery({
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
    <Card style={{ gap: 14 }}>
      <Txt style={{ fontSize: 20, fontWeight: "700" }}>
        Central de denúncias
      </Txt>
      <Txt>
        A identidade do denunciante e as justificativas internas ficam restritas
        à administração. A quantidade de denúncias não comprova infração.
      </Txt>
      <Choices
        label="Filtrar denúncias"
        value={state}
        options={{ all: "Todas", ...reportLabels }}
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
            title="Tentar carregar denúncias novamente"
            outline
            onPress={() => void list.refetch()}
          />
        </>
      ) : (
        <>
          <Txt>{list.data.total} denúncia(s) encontrada(s).</Txt>
          {list.data.items.map((r) => (
            <ReportCard
              key={`${r.occurrence_id}:${r.reporter_id}:${r.review_version}:${r.hidden}`}
              report={r}
            />
          ))}
          {!list.data.items.length && (
            <Txt>Nenhuma denúncia nesta situação.</Txt>
          )}
          <Button
            title="Denúncias anteriores"
            outline
            disabled={!offset}
            onPress={() => setOffset(Math.max(0, offset - 20))}
          />
          <Button
            title="Próximas denúncias"
            outline
            disabled={offset + 20 >= list.data.total}
            onPress={() => setOffset(offset + 20)}
          />
        </>
      )}
    </Card>
  );
}
function ReportCard({ report }: { report: AdminReport }) {
  const cache = useQueryClient();
  const [state, setState] = useState("reviewing"),
    [note, setNote] = useState(report.review_note || ""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function act(hide?: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (note.trim().length < 5 || note.trim().length > 1000)
        throw Error("Informe uma justificativa com 5 a 1.000 caracteres.");
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
      setMessage("Decisão registrada na auditoria.");
      await cache.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 12 }}>
      <Txt style={{ fontWeight: "700" }}>
        {reportReasons[report.reason] || report.reason} ·{" "}
        {reportLabels[report.review_state]}
      </Txt>
      <Txt>{report.description || "Sem observação adicional."}</Txt>
      <Txt>Denunciante: {report.reporter_email}</Txt>
      <Txt>Autor: {report.author_email}</Txt>
      <Txt muted>
        {new Date(report.created_at).toLocaleString("pt-BR")} · Registro{" "}
        {report.hidden ? "ocultado" : "visível"}
      </Txt>
      <Button
        title="Abrir registro denunciado"
        outline
        onPress={() =>
          router.push({
            pathname: "/ocorrencia/[id]",
            params: { id: report.occurrence_id, staff: "1" },
          })
        }
      />
      <Choices
        label="Decisão sobre a denúncia"
        value={state}
        options={{
          reviewing: "Em análise",
          resolved: "Resolvida após providência",
          dismissed: "Arquivada",
        }}
        onChange={setState}
        disabled={busy}
      />
      <Field
        label="Justificativa interna"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
        editable={!busy}
      />
      <Button
        title="Salvar análise da denúncia"
        busy={busy}
        onPress={() => void act()}
      />
      <Button
        title={
          report.hidden
            ? "Restaurar registro após revisão"
            : "Ocultar registro após revisão"
        }
        outline
        disabled={busy}
        onPress={() =>
          Alert.alert(
            "Confirmar moderação",
            `${report.hidden ? "Restaurar" : "Ocultar"} este registro? A decisão será auditada.`,
            [
              { text: "Voltar", style: "cancel" },
              { text: "Confirmar", onPress: () => void act(!report.hidden) },
            ],
          )
        }
      />
      <Notice text="Ocultar retira o registro das listas públicas. A foto pode continuar acessível pelo endereço direto; remover o arquivo exige ação no armazenamento." />
      {!!error && <Notice error text={error} />}{" "}
      {!!message && <Notice text={message} />}
    </Card>
  );
}

import { useState } from "react";
import { Alert, Image, Platform } from "react-native";
import { Redirect, router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen, Card, Txt, Button, Notice } from "../src/components/ui";
import { useAuth } from "../src/providers";
import { offlineDrafts } from "../src/lib/offline";
import { saveOccurrence } from "../src/lib/occurrences";
import type { OfflineDraft } from "../src/lib/draft-queue";

export default function Drafts() {
  const { user, demo, loading } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["offline-drafts", user?.id],
    enabled: !!user && !demo && Platform.OS !== "web",
    queryFn: () => offlineDrafts.list(user!.id),
    retry: false,
  });
  async function send(draft: OfflineDraft) {
    setBusy(true);
    setMessage("");
    try {
      if (!user || user.id !== draft.owner)
        throw new Error("Entre na conta que criou este rascunho.");
      await saveOccurrence(
        draft.photo,
        {
          detections: [],
          image_width: draft.photo.width,
          image_height: draft.photo.height,
          simulated: false,
          unavailable: true,
        },
        draft.point,
        draft.description,
        false,
        draft.id,
        draft.owner,
        { type: draft.problem_type, danger: draft.immediate_danger },
      );
      await offlineDrafts.remove(draft.owner, draft.id);
      await cache.invalidateQueries();
      setMessage("Ocorrência enviada. O rascunho foi removido deste aparelho.");
    } catch (error) {
      setMessage(
        (error as Error).message +
          " O rascunho foi preservado; tente novamente com conexão.",
      );
    } finally {
      setBusy(false);
    }
  }
  function confirmSend(draft: OfflineDraft) {
    Alert.alert(
      "Publicar ocorrência?",
      `Você confirma o ponto ${draft.point[0].toFixed(6)}, ${draft.point[1].toFixed(6)} e autoriza compartilhar publicamente a foto e as observações? O envio será sem análise da IA.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Autorizar e enviar", onPress: () => void send(draft) },
      ],
    );
  }
  function discard(draft: OfflineDraft) {
    Alert.alert(
      "Apagar rascunho?",
      "A foto e os dados locais serão removidos deste aparelho.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            setMessage("");
            void offlineDrafts
              .remove(draft.owner, draft.id)
              .then(() => query.refetch())
              .catch((error) => setMessage(error.message))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }
  if (loading)
    return (
      <Screen title="Rascunhos">
        <Txt>Restaurando sessão…</Txt>
      </Screen>
    );
  if (!user) return <Redirect href="/login" />;
  return (
    <Screen
      back
      title="Rascunhos neste aparelho"
      subtitle="Guarde agora e envie quando tiver internet."
    >
      <Notice text="As fotos e coordenadas ficam no armazenamento do aplicativo. Não são enviadas automaticamente. Desinstalar o app ou limpar seus dados pode apagar os rascunhos. A análise da IA e o envio exigem conexão." />
      {!!message && <Notice text={message} />}
      {Platform.OS === "web" || demo ? (
        <Notice text="Os rascunhos com fotos estão disponíveis no aplicativo Android, com uma conta real." />
      ) : (
        <>
          <Button
            title="Capturar outro registro"
            onPress={() => router.push("/(tabs)/registrar")}
            disabled={busy}
          />
          {query.isPending && <Txt>Carregando rascunhos…</Txt>}
          {query.error && (
            <>
              <Notice text={query.error.message} error />
              <Button
                title="Tentar ler novamente"
                outline
                onPress={() => void query.refetch()}
              />
            </>
          )}
          {query.isSuccess && !query.data.length && (
            <Txt>Nenhum rascunho guardado nesta conta e neste aparelho.</Txt>
          )}
          {query.data?.map((draft) => (
            <Card key={draft.id} style={{ gap: 12, marginTop: 16 }}>
              <Image
                source={{ uri: draft.photo.uri }}
                accessibilityLabel="Foto do rascunho"
                style={{ width: "100%", height: 210, borderRadius: 12 }}
                resizeMode="contain"
              />
              <Txt>{new Date(draft.created_at).toLocaleString("pt-BR")}</Txt>
              <Txt>
                {draft.point[0].toFixed(6)}, {draft.point[1].toFixed(6)}
              </Txt>
              {!!draft.description && <Txt>{draft.description}</Txt>}
              <Txt muted>Não publicado · Sem análise da IA</Txt>
              <Button
                title="Revisar autorização e enviar"
                disabled={busy}
                onPress={() => confirmSend(draft)}
              />
              <Button
                title="Apagar rascunho"
                outline
                disabled={busy}
                onPress={() => discard(draft)}
              />
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

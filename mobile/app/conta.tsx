import { useState } from "react";
import { Image, Switch, View, Platform } from "react-native";
import { Redirect } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Screen,
  Card,
  Txt,
  Field,
  Button,
  Notice,
  Loading,
} from "../src/components/ui";
import { useAuth } from "../src/providers";
import { supabase } from "../src/lib/supabase";
import { normalizeWhatsapp } from "../src/lib/account";
import { pickPhoto, multipartPhoto } from "../src/lib/photos";
import { openPortal, portalUrl } from "../src/lib/portal";

type Preferences = {
  whatsapp: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  avatar_path: string | null;
};

export default function Account() {
  const { user, demo, loading } = useAuth();
  const cache = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const preferences = useQuery({
    queryKey: ["contact-preferences", user?.id],
    enabled: !!user && !demo && !!supabase,
    retry: false,
    queryFn: async () => {
      const result = await supabase!.rpc("viaalerta_my_preferences");
      if (result.error)
        throw new Error(
          "Não foi possível carregar as preferências. Confira a conexão e a atualização do banco.",
        );
      return result.data as Preferences;
    },
  });
  const avatar = useQuery({
    queryKey: ["profile-avatar", user?.id, preferences.data?.avatar_path],
    enabled: !!user && !demo && !!supabase && !!preferences.data?.avatar_path,
    retry: false,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const result = await supabase!.storage
        .from("viaalerta-avatars")
        .createSignedUrl(preferences.data!.avatar_path!, 3600);
      if (result.error)
        throw new Error(
          "Foto indisponível. Você pode continuar editando seus contatos.",
        );
      return result.data.signedUrl;
    },
  });
  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return (
    <Screen
      title="Foto e contato"
      subtitle="Escolha como acompanhar os seus registros."
      back
    >
      {!!feedback && <Notice text={feedback} />}
      {demo ? (
        <Notice text="Entre com uma conta real para editar foto e preferências de contato." />
      ) : preferences.isPending ? (
        <Loading />
      ) : preferences.isError ? (
        <Card>
          <Notice error text={preferences.error.message} />
          <Button
            title="Tentar novamente"
            onPress={() => void preferences.refetch()}
          />
        </Card>
      ) : (
        <Settings
          key={JSON.stringify(preferences.data)}
          initial={preferences.data}
          avatar={avatar.data}
          avatarError={avatar.isError ? avatar.error.message : ""}
          notify={setFeedback}
          refresh={async () => {
            await cache.invalidateQueries({
              queryKey: ["contact-preferences", user.id],
            });
            await cache.invalidateQueries({
              queryKey: ["profile-avatar", user.id],
            });
          }}
        />
      )}
    </Screen>
  );
}

function Settings({
  initial,
  avatar,
  avatarError,
  refresh,
  notify,
}: {
  initial: Preferences;
  avatar?: string;
  avatarError: string;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function perform(
    action: () => Promise<void | boolean>,
    success: string,
  ) {
    setBusy(true);
    setError("");
    notify("");
    try {
      const done = await action();
      if (done !== false) {
        notify(success);
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    await perform(async () => {
      const whatsapp = normalizeWhatsapp(value.whatsapp);
      if (value.whatsapp_enabled && !whatsapp)
        throw new Error("Informe um número antes de autorizar WhatsApp.");
      const result = await supabase!.rpc("viaalerta_save_preferences", {
        p_whatsapp: whatsapp || null,
        p_email: value.email_enabled,
        p_whatsapp_enabled: value.whatsapp_enabled,
      });
      if (result.error)
        throw new Error("Não foi possível salvar suas preferências.");
    }, "Preferências salvas. Os envios externos dependem da ativação dos serviços.");
  }
  async function upload() {
    await perform(async () => {
      const photo = await pickPhoto(false);
      if (!photo) return false;
      const session = await supabase!.auth.getSession();
      if (!session.data.session)
        throw new Error("Entre novamente para enviar sua foto.");
      const response = await (Platform.OS === "web" ? fetch : expoFetch)(
        portalUrl("/api/profile-photo"),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: await multipartPhoto(photo),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          result.error ||
            "Não foi possível enviar sua foto. A web atualizada precisa estar publicada.",
        );
      }
    }, "Foto de perfil atualizada.");
  }
  async function remove() {
    await perform(async () => {
      const result = await supabase!.rpc("viaalerta_set_avatar", {
        p_path: null,
      });
      if (result.error)
        throw new Error(
          "Não foi possível confirmar a remoção da foto. Atualize antes de tentar novamente.",
        );
      if (initial.avatar_path)
        await supabase!.storage
          .from("viaalerta-avatars")
          .remove([initial.avatar_path])
          .catch(() => {});
    }, "Foto removida do perfil.");
  }
  return (
    <Card style={{ gap: 16 }}>
      <Txt style={{ fontSize: 19, fontWeight: "700" }}>Sua foto</Txt>
      <Txt muted>A foto do perfil fica em armazenamento privado.</Txt>
      {avatar && (
        <Image
          accessibilityLabel="Sua foto de perfil"
          source={{ uri: avatar }}
          style={{ width: 96, height: 96, borderRadius: 48 }}
        />
      )}
      {!!avatarError && <Notice text={avatarError} />}
      <Button
        title="Adicionar ou trocar foto"
        outline
        disabled={busy}
        onPress={() => void upload()}
      />
      {initial.avatar_path && (
        <Button
          title="Remover foto do perfil"
          outline
          disabled={busy}
          onPress={() => void remove()}
        />
      )}
      <Txt style={{ fontSize: 19, fontWeight: "700" }}>
        Preferências de contato
      </Txt>
      <Txt muted>
        As notificações no aplicativo continuam disponíveis. E-mail e WhatsApp
        são opcionais e destinados a atualizações dos seus registros.
      </Txt>
      <Field
        label="WhatsApp com DDI e DDD"
        value={value.whatsapp || ""}
        onChangeText={(whatsapp) =>
          setValue({ ...value, whatsapp, whatsapp_enabled: false })
        }
        keyboardType="phone-pad"
        maxLength={25}
        editable={!busy}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Switch
          accessibilityLabel="Receber atualizações no e-mail da minha conta"
          value={value.email_enabled}
          disabled={busy}
          onValueChange={(email_enabled) =>
            setValue({ ...value, email_enabled })
          }
        />
        <View style={{ flex: 1 }}>
          <Txt>Quero receber atualizações no e-mail da minha conta.</Txt>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Switch
          accessibilityLabel="Confirmo que controlo o número e autorizo atualizações por WhatsApp"
          value={value.whatsapp_enabled}
          disabled={busy}
          onValueChange={(whatsapp_enabled) =>
            setValue({ ...value, whatsapp_enabled })
          }
        />
        <View style={{ flex: 1 }}>
          <Txt>
            Confirmo que controlo este número e autorizo atualizações por
            WhatsApp.
          </Txt>
        </View>
      </View>
      <Notice text="Você pode desativar cada canal a qualquer momento. O envio real depende da ativação dos provedores pelo responsável do projeto." />
      <Button
        title="Salvar preferências"
        busy={busy}
        onPress={() => void save()}
      />
      <Button
        title="Privacidade e uso dos dados"
        outline
        disabled={busy}
        onPress={() =>
          void openPortal("/privacidade").catch(() =>
            setError("Não foi possível abrir a página de privacidade."),
          )
        }
      />
      {!!error && <Notice error text={error} />}
    </Card>
  );
}

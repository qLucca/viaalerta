"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { preparePhoto } from "@/lib/photo";
import { normalizeWhatsapp } from "@/lib/account";

type Preferences = {
  whatsapp: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  avatar_path: string | null;
};
const empty: Preferences = {
  whatsapp: "",
  email_enabled: false,
  whatsapp_enabled: false,
  avatar_path: null,
};

export function AccountSettings() {
  const { user, demo } = useAuth();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["contact-preferences", user?.id],
    enabled: !!user && !demo && !!supabase,
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("viaalerta_my_preferences");
      if (error)
        throw new Error(
          "Preferências indisponíveis. A atualização do banco precisa estar instalada.",
        );
      const preferences = { ...empty, ...data } as Preferences;
      return { preferences };
    },
    retry: false,
  });
  const avatarQuery = useQuery({
    queryKey: ["profile-avatar", user?.id, query.data?.preferences.avatar_path],
    enabled:
      !!user && !demo && !!query.data?.preferences.avatar_path && !!supabase,
    queryFn: async () => {
      const signed = await supabase!.storage
        .from("viaalerta-avatars")
        .createSignedUrl(query.data!.preferences.avatar_path!, 3600);
      if (signed.error)
        throw new Error(
          "Não foi possível carregar sua foto. Suas preferências continuam disponíveis.",
        );
      return signed.data.signedUrl;
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
  if (demo)
    return (
      <section className="panel form-section">
        <h2>Foto e comunicações</h2>
        <p>
          Entre com uma conta real para adicionar sua foto e escolher os canais
          de contato.
        </p>
      </section>
    );
  if (query.isPending)
    return (
      <section className="panel form-section" role="status">
        Carregando preferências…
      </section>
    );
  if (query.isError)
    return (
      <section className="panel form-section">
        <p role="alert">{query.error.message}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </section>
    );
  return (
    <SettingsForm
      key={JSON.stringify(query.data.preferences)}
      initial={query.data.preferences}
      avatar={avatarQuery.data || ""}
      avatarError={avatarQuery.isError ? avatarQuery.error.message : ""}
      refresh={async () => {
        await cache.invalidateQueries({
          queryKey: ["contact-preferences", user?.id],
        });
        await cache.invalidateQueries({
          queryKey: ["profile-avatar", user?.id],
        });
      }}
    />
  );
}

function SettingsForm({
  initial,
  avatar,
  avatarError,
  refresh,
}: {
  initial: Preferences;
  avatar: string;
  avatarError: string;
  refresh: () => Promise<void>;
}) {
  const [preferences, setPreferences] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const whatsapp = normalizeWhatsapp(preferences.whatsapp);
      if (preferences.whatsapp_enabled && !whatsapp)
        throw new Error("Informe o número antes de autorizar WhatsApp.");
      const result = await supabase!.rpc("viaalerta_save_preferences", {
        p_whatsapp: whatsapp || null,
        p_email: preferences.email_enabled,
        p_whatsapp_enabled: preferences.whatsapp_enabled,
      });
      if (result.error)
        throw new Error(
          "Não foi possível salvar as preferências. Tente novamente.",
        );
      toast.success(
        "Preferências salvas. O envio externo depende da ativação dos serviços.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const photo = await preparePhoto(file);
      const session = await supabase!.auth.getSession();
      if (!session.data.session)
        throw new Error("Entre novamente para enviar sua foto.");
      const body = new FormData();
      body.append("file", photo.file);
      const response = await fetch("/api/profile-photo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
        },
        body,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Não foi possível enviar a foto.");
      }
      await refresh();
      toast.success("Foto de perfil atualizada.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  async function remove() {
    setUploading(true);
    setError("");
    try {
      const saved = await supabase!.rpc("viaalerta_set_avatar", {
        p_path: null,
      });
      if (saved.error) throw new Error("Não foi possível remover sua foto.");
      if (preferences.avatar_path)
        await supabase!.storage
          .from("viaalerta-avatars")
          .remove([preferences.avatar_path]);
      await refresh();
      toast.success("Foto de perfil removida.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="panel form-section stack">
      <h2>Foto de perfil</h2>
      <p>
        Sua foto fica em armazenamento privado e aparece nesta área da conta.
      </p>
      {avatarError && <p role="status">{avatarError}</p>}
      {avatar && (
        <Image
          unoptimized
          src={avatar}
          alt="Sua foto de perfil"
          width={96}
          height={96}
          className="account-photo"
        />
      )}
      <label className="field">
        Adicionar ou trocar foto (JPG, PNG ou WebP)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading || busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void upload(file);
          }}
        />
      </label>
      {uploading && <p role="status">Atualizando foto…</p>}
      {initial.avatar_path && (
        <Button
          variant="outline"
          disabled={uploading || busy}
          onClick={() => void remove()}
        >
          Remover foto de perfil
        </Button>
      )}
      <Link className="text-link" href="/registrar">
        Adicionar foto de um problema na via
      </Link>
      <h2>Como você quer acompanhar os registros?</h2>
      <p>
        As notificações no site continuam disponíveis. E-mail e WhatsApp são
        opcionais, destinados a atualizações dos seus registros, sem
        publicidade.
      </p>
      <form onSubmit={save} className="stack">
        <label className="field">
          WhatsApp com DDI e DDD
          <input
            type="tel"
            autoComplete="tel"
            maxLength={25}
            placeholder="+55 34 99999-9999"
            value={preferences.whatsapp}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                whatsapp: e.target.value,
                whatsapp_enabled: false,
              })
            }
            disabled={busy}
          />
        </label>
        <label className="consent-option">
          <input
            type="checkbox"
            checked={preferences.email_enabled}
            disabled={busy}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                email_enabled: e.target.checked,
              })
            }
          />
          Quero receber atualizações no e-mail da minha conta.
        </label>
        <label className="consent-option">
          <input
            type="checkbox"
            checked={preferences.whatsapp_enabled}
            disabled={busy}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                whatsapp_enabled: e.target.checked,
              })
            }
          />
          Confirmo que controlo este número e autorizo receber atualizações por
          WhatsApp.
        </label>
        <p>
          Você pode desativar cada canal aqui a qualquer momento.{" "}
          <Link className="text-link" href="/privacidade">
            Entenda como seus dados são usados.
          </Link>
        </p>
        <div className="info-box">
          Os serviços externos ainda precisam ser ativados pelo responsável pelo
          projeto. Salvar uma preferência não confirma o envio de mensagens.
        </div>
        <Button disabled={busy || uploading}>
          {busy ? "Salvando…" : "Salvar preferências de contato"}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

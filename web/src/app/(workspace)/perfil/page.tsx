"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shell, ThemeSwitch } from "@/components/layout/shell";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { countOccurrences } from "@/lib/api/occurrences";
export default function Profile() {
  const { user } = useAuth();
  return <ProfileContent key={`${user?.id}:${user?.name}`} />;
}
function ProfileContent() {
  const { user, demo, rename, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { data = 0 } = useQuery({
    queryKey: ["mine", demo, user?.id],
    queryFn: () => countOccurrences(demo, { mine: true }),
    enabled: !!user,
  });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || name.trim().length > 80) {
      toast.error("Informe um nome entre 2 e 80 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (!demo && supabase) {
        const { error } = await supabase.auth.updateUser({
          data: { name: name.trim() },
        });
        if (error) throw error;
        const result = await supabase
          .from("viaalerta_profiles")
          .update({ name: name.trim() })
          .eq("id", user!.id);
        if (result.error) throw result.error;
      }
      rename(name.trim());
      toast.success("Perfil atualizado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell
      title="Meu perfil"
      subtitle="Seu espaço para cuidar dos dados e das preferências."
    >
      <div className="profile-grid">
        <section className="panel form-section">
          <div className="profile-header">
            <span className="avatar large">{user?.name[0]?.toUpperCase()}</span>
            <div>
              <h2>{user?.name}</h2>
              <p>
                {demo ? "Visitante de demonstração" : "Colaborador ViaAlerta"}
              </p>
            </div>
          </div>
          <form onSubmit={save} className="stack">
            <label className="field">
              Nome
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
            </label>
            <label className="field">
              E-mail
              <input value={user?.email || ""} disabled />
            </label>
            <Button disabled={busy}>
              {busy ? "Salvando…" : "Salvar alterações"}
            </Button>
          </form>
        </section>
        <section className="panel form-section">
          <h2>Sua experiência</h2>
          <div className="preference">
            <div>
              <strong>Aparência</strong>
              <p>Claro, escuro ou igual ao sistema.</p>
            </div>
            <ThemeSwitch />
          </div>
          <div className="preference">
            <div>
              <strong>
                {data} contribuições {demo ? "de demonstração" : ""}
              </strong>
              <p>Obrigado por olhar pela cidade.</p>
            </div>
          </div>
          <div className="info-box">
            Guardamos apenas o necessário para sua conta e seus registros. A
            localização solicitada se refere à ocorrência e só é coletada por
            sua ação.
          </div>
          <Button
            variant="outline"
            onClick={() =>
              logout()
                .then(() => router.push("/"))
                .catch((e) => toast.error(e.message))
            }
          >
            Encerrar sessão
          </Button>
        </section>
      </div>
    </Shell>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { passwordProblem } from "@/lib/account";

export function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nonce, setNonce] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function reauthenticate() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await supabase!.auth.reauthenticate();
      if (result.error) throw result.error;
      setMessage(
        "Confira seu e-mail e informe o código de confirmação recebido. O envio depende da configuração de e-mail do Supabase.",
      );
    } catch {
      setError(
        "Não foi possível solicitar a confirmação. Tente novamente ou use a recuperação de senha.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const result = await supabase!.auth.updateUser({
        password,
        ...(nonce.trim() ? { nonce: nonce.trim() } : {}),
      });
      if (result.error) {
        setError(
          result.error.code === "reauthentication_needed"
            ? "Confirme sua identidade com o botão abaixo e informe o código recebido."
            : "Não foi possível trocar a senha. Verifique o segundo fator, a confirmação e os requisitos da senha.",
        );
        return;
      }
      setPassword("");
      setConfirmation("");
      setNonce("");
      const logout = await supabase!.auth.signOut({ scope: "others" });
      setMessage(
        logout.error
          ? "Senha atualizada. Não foi possível encerrar as outras sessões; tente novamente em outro momento."
          : "Senha atualizada. As outras sessões foram encerradas; tokens já emitidos podem permanecer válidos até expirar.",
      );
    } catch {
      setError("Não foi possível atualizar a senha. Confira a conexão.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel form-section stack">
      <h2>Trocar senha</h2>
      <p>
        Use pelo menos 12 caracteres. Se sua conta exige duas etapas, verifique
        a sessão acima antes de trocar a senha.
      </p>
      <form onSubmit={save} className="stack">
        <label className="field">
          Nova senha
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          Confirmar nova senha
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={confirmation}
            disabled={busy}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <label className="field">
          Código de confirmação por e-mail, se solicitado
          <input
            autoComplete="one-time-code"
            value={nonce}
            maxLength={64}
            disabled={busy}
            onChange={(e) => setNonce(e.target.value)}
          />
        </label>
        <Button disabled={busy}>
          {busy ? "Aguarde…" : "Salvar nova senha"}
        </Button>
      </form>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void reauthenticate()}
      >
        Solicitar confirmação por e-mail
      </Button>
      <Link className="text-link" href="/recuperar-senha">
        Recuperar acesso por e-mail
      </Link>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

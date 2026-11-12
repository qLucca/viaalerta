"use client";
import Image from "next/image";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/layout/shell";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers";
export default function Security() {
  const { demo } = useAuth(),
    cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [factor, setFactor] = useState(""),
    [qr, setQr] = useState(""),
    [secret, setSecret] = useState(""),
    [code, setCode] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function start() {
    if (!supabase || demo) return;
    setBusy(true);
    setError("");
    try {
      const list = await supabase.auth.mfa.listFactors();
      if (list.error) throw list.error;
      const verified = list.data.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactor(verified.id);
        setMessage(
          "Informe o código do aplicativo autenticador para verificar esta sessão.",
        );
      } else {
        const previous = list.data.all.find(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        );
        if (previous)
          await supabase.auth.mfa.unenroll({ factorId: previous.id });
        const result = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "ViaAlerta",
        });
        if (result.error) throw result.error;
        setFactor(result.data.id);
        setQr(result.data.totp.qr_code);
        setSecret(result.data.totp.secret);
        setMessage(
          "Leia o QR com seu aplicativo autenticador. Depois informe o código de seis dígitos.",
        );
      }
    } catch {
      setError(
        "Não foi possível preparar a verificação. Confira sua sessão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (result.error) throw result.error;
      setQr("");
      setSecret("");
      setCode("");
      await cache.invalidateQueries();
      setMessage(
        "Sessão verificada em duas etapas. Volte ao painel para continuar.",
      );
    } catch {
      setError(
        "Código inválido ou expirado. Confira o aplicativo e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell
      title="Segurança da conta"
      subtitle="Verificação em duas etapas obrigatória para gestores e administradores."
    >
      <section className="panel form-section stack">
        {demo ? (
          <p>
            A configuração de segurança exige uma conta real. A demonstração não
            altera sua conta.
          </p>
        ) : (
          <>
            <p>
              Use um aplicativo autenticador. Não compartilhe o QR, a chave ou
              os códigos de acesso.
            </p>
            <Button onClick={start} disabled={busy}>
              {busy ? "Preparando…" : "Configurar ou verificar duas etapas"}
            </Button>
            {qr && (
              <Image
                unoptimized
                src={qr}
                width={220}
                height={220}
                alt="QR para cadastrar a conta no aplicativo autenticador"
              />
            )}
            {secret && (
              <details>
                <summary>Chave para configuração manual</summary>
                <code>{secret}</code>
              </details>
            )}
            {factor && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void verify();
                }}
              >
                <label className="field">
                  Código do autenticador
                  <input
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                    minLength={6}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={busy}
                  />
                </label>
                <Button disabled={busy || code.length !== 6}>
                  {busy ? "Verificando…" : "Verificar sessão"}
                </Button>
              </form>
            )}
          </>
        )}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </Shell>
  );
}

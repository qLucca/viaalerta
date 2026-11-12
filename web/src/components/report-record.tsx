"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { reportRecord } from "@/lib/api/registration";
export function ReportRecord({ id }: { id: string }) {
  const { demo, user } = useAuth(),
    [reason, setReason] = useState("dados_pessoais"),
    [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  if (!user)
    return (
      <p>
        <Link className="text-link" href="/login">
          Entre na sua conta para denunciar este registro.
        </Link>
      </p>
    );
  return (
    <details className="panel form-section">
      <summary>Denunciar registro</summary>
      <p>
        Avise sobre dados pessoais, conteúdo inadequado ou local incorreto. A
        denúncia não altera o status automaticamente.
      </p>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await reportRecord(id, reason, description, demo);
            setMessage(
              demo
                ? "Denúncia simulada: não foi enviada à moderação."
                : "Denúncia recebida para revisão. Obrigado por avisar.",
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="field">
          <label htmlFor="report-reason">Motivo</label>
          <select
            id="report-reason"
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          >
            <option value="dados_pessoais">
              Dados pessoais na foto ou observação
            </option>
            <option value="conteudo_inadequado">Conteúdo inadequado</option>
            <option value="local_incorreto">Local incorreto</option>
            <option value="outro">Outro motivo</option>
          </select>
        </div>
        <label className="field">
          Detalhes {reason === "outro" ? "(obrigatório)" : "(opcional)"}
          <textarea
            value={description}
            maxLength={500}
            minLength={reason === "outro" ? 5 : undefined}
            required={reason === "outro"}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <Button disabled={busy || !!message}>
          {busy ? "Enviando…" : "Enviar denúncia"}
        </Button>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}

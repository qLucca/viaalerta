"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./providers";
import { useRole } from "@/lib/use-role";
import {
  processHistory,
  publishUpdate,
  recordPermissions,
} from "@/lib/api/process";
import {
  transitions,
  workflowProblem,
  rejectionReasons,
  roleLabels,
} from "@/lib/workflow";
import { statusLabels, type Status } from "@/types";
import { StatusBadge } from "./occurrences";
import { dateLabel } from "@/lib/format";
import { Button } from "./ui/button";
import { preparePhoto } from "@/lib/photo";
import { sessionToken } from "@/lib/api/registration";
import { supabase } from "@/lib/supabase/client";
export function ProcessPanel({ id, status }: { id: string; status: Status }) {
  const { user, demo } = useAuth(),
    { staff, needsMfa } = useRole(),
    cache = useQueryClient();
  const history = useQuery({
    queryKey: ["process", id],
    queryFn: () => processHistory(id),
    enabled: !demo,
    refetchInterval: 30000,
    retry: false,
  });
  const permission = useQuery({
    queryKey: ["record-permissions", id, user?.id],
    queryFn: () => recordPermissions(id),
    enabled: !!user && !demo,
    retry: false,
  });
  if (permission.data?.cancelled)
    return (
      <p>Registro cancelado. Não há novas intervenções para este registro.</p>
    );
  return (
    <section className="panel form-section process-panel">
      <h2>Linha do tempo do registro</h2>
      {demo ? (
        <p>
          Exemplo de acompanhamento. Atualizações reais da prefeitura aparecerão
          aqui após a habilitação do serviço.
        </p>
      ) : history.isPending ? (
        <p role="status">Carregando acompanhamento…</p>
      ) : history.error ? (
        <p role="alert">{history.error.message}</p>
      ) : !history.data?.length ? (
        <p>Aguardando triagem. Ainda não há encaminhamento para análise.</p>
      ) : (
        <ol className="process-timeline">
          {history.data.map((item) => (
            <li key={item.id} className="process-event">
              <div className="section-heading">
                <StatusBadge status={item.status as Status} />
                <time dateTime={item.created_at}>
                  {dateLabel(item.created_at)}
                </time>
              </div>
              <p className="process-message">{item.message}</p>
              {item.intervention_date && (
                <p>
                  Previsão de intervenção:{" "}
                  {item.intervention_date.split("-").reverse().join("/")}. A
                  data pode ser revista.
                </p>
              )}
              {item.rejection_reason && (
                <p>
                  Motivo:{" "}
                  {
                    rejectionReasons[
                      item.rejection_reason as keyof typeof rejectionReasons
                    ]
                  }
                </p>
              )}
              {item.after_image_path && supabase && (
                <Image
                  unoptimized
                  src={
                    supabase.storage
                      .from("viaalerta-interventions")
                      .getPublicUrl(item.after_image_path).data.publicUrl
                  }
                  width={640}
                  height={480}
                  alt="Foto publicada pela equipe após a intervenção"
                />
              )}
              <small>
                {roleLabels[item.actor_role as keyof typeof roleLabels] ||
                  "Equipe municipal"}
              </small>
            </li>
          ))}
        </ol>
      )}
      {needsMfa && (
        <p>
          <Link className="text-link" href="/seguranca">
            Verifique sua sessão em duas etapas para atuar neste registro.
          </Link>
        </p>
      )}
      {staff && permission.data?.can_manage && (
        <ProcessForm
          key={id + ":" + permission.data.version + ":" + status}
          id={id}
          status={status}
          version={permission.data.version}
          refresh={() => cache.invalidateQueries()}
        />
      )}
    </section>
  );
}
function ProcessForm({
  id,
  status: current,
  version,
  refresh,
}: {
  id: string;
  status: Status;
  version: number;
  refresh: () => Promise<void>;
}) {
  const [status, setStatus] = useState(
      transitions[current]?.[0] || "em_analise",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [after, setAfter] = useState(""),
    [photoConsent, setPhotoConsent] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setAfter("");
    try {
      const photo = await preparePhoto(file),
        body = new FormData();
      body.append("file", photo.file);
      body.append("id", id);
      body.append("consent", String(photoConsent));
      const response = await fetch("/api/intervention-photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${await sessionToken()}` },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setAfter(result.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      message = String(data.get("message") || ""),
      date = String(data.get("date") || ""),
      reason = String(data.get("reason") || ""),
      related = String(data.get("related") || "");
    const problem = workflowProblem(
      current,
      status,
      message,
      date,
      after,
      reason,
      related,
    );
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await publishUpdate({
        id,
        status,
        message,
        date,
        version,
        after,
        reason,
        related,
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="process-form stack">
      <h3>Publicar andamento</h3>
      <label htmlFor="process-status">Nova situação</label>
      <select
        id="process-status"
        value={status}
        disabled={busy}
        onChange={(e) => setStatus(e.target.value)}
      >
        {(transitions[current] || []).map((s) => (
          <option key={s} value={s}>
            {statusLabels[s as Status]}
          </option>
        ))}
      </select>
      <label className="field">
        Comentário para o cidadão
        <textarea
          name="message"
          required
          minLength={5}
          maxLength={2000}
          rows={4}
          disabled={busy}
        />
      </label>
      <label className="field">
        Data prevista de intervenção
        <input
          name="date"
          type="date"
          required={status === "programado"}
          disabled={busy}
        />
      </label>
      {status === "rejeitado" && (
        <>
          <label htmlFor="process-reason">Motivo da rejeição</label>
          <select name="reason" id="process-reason" required disabled={busy}>
            <option value="">Escolha um motivo</option>
            {Object.entries(rejectionReasons).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </>
      )}
      {status === "duplicado" && (
        <label className="field">
          Número completo do registro principal
          <input
            name="related"
            required
            disabled={busy}
            placeholder="Copie o identificador do registro que já atende este problema."
          />
        </label>
      )}
      {status === "resolvido" && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={photoConsent}
              disabled={busy || !!after}
              onChange={(e) => setPhotoConsent(e.target.checked)}
            />
            Autorizo a publicação da foto posterior junto ao andamento.
          </label>
          <label className="field">
            Foto do serviço concluído
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || !photoConsent}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </label>
          <p role="status">
            {after
              ? "Foto posterior preparada."
              : "A foto é obrigatória para concluir o serviço."}
          </p>
        </>
      )}
      <p>
        O comentário será visível ao cidadão. Não inclua dados internos. O
        e-mail só é enviado quando o serviço de notificações estiver
        configurado.
      </p>
      {error && (
        <div role="alert">
          {error}{" "}
          <button type="button" onClick={() => void refresh()}>
            Recarregar processo
          </button>
        </div>
      )}
      <Button disabled={busy || (status === "resolvido" && !after)}>
        {busy ? "Salvando…" : "Publicar atualização"}
      </Button>
    </form>
  );
}

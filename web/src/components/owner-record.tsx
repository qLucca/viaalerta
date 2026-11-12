"use client";
import {toast} from "sonner";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { recordPermissions, ownerChange } from "@/lib/api/process";
import { readDemo, saveDemo } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import type { Occurrence } from "@/types";
export function OwnerRecord({ record }: { record: Occurrence }) {
  const { user, demo } = useAuth(),
    cache = useQueryClient();
  const [note, setNote] = useState(record.description),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const permission = useQuery({
    queryKey: ["record-permissions", record.id, user?.id],
    queryFn: () => recordPermissions(record.id),
    enabled: !!user && !demo,
    retry: false,
  });
  const canEdit = demo
    ? record.owner_id === "demo" &&
      record.status === "pendente" &&
      !record.cancelled_at
    : permission.data?.can_edit;
  const cancelled = demo ? !!record.cancelled_at : permission.data?.cancelled;
  async function change(cancel: boolean) {
    if (
      cancel &&
      !confirm(
        "Cancelar este registro? Ele sairá do mapa público e ficará disponível para você.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      if (demo) {
        saveDemo(
          readDemo().map((r) =>
            r.id === record.id
              ? {
                  ...r,
                  description: note,
                  cancelled_at: cancel ? new Date().toISOString() : null,
                }
              : r,
          ),
        );
      } else
        await ownerChange(record.id, note, cancel, permission.data!.version);
      toast.success(cancel?"Registro cancelado.":"Observação atualizada.");
      await cache.invalidateQueries();
      setMessage(
        cancel
          ? "Registro cancelado e retirado do mapa público."
          : "Observação atualizada.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (cancelled)
    return (
      <p className="info-box">
        Registro cancelado pelo autor. Ele não aparece no mapa público.
      </p>
    );
  if (!canEdit) return null;
  return (
    <details className="panel form-section">
      <summary>Editar ou cancelar meu registro</summary>
      <p>
        Disponível enquanto o registro estiver reportado, antes do atendimento.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void change(false);
        }}
      >
        <label className="field">
          Observação
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            disabled={busy}
          />
        </label>
        <div className="actions">
          <Button disabled={busy}>
            {busy ? "Salvando…" : "Salvar observação"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => change(true)}
          >
            Cancelar registro
          </Button>
        </div>
        {message && <p role="status">{message}</p>}
      </form>
    </details>
  );
}

"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/layout/shell";
import { useAuth } from "@/components/providers";
import { notifications, markRead } from "@/lib/api/process";
import { dateLabel } from "@/lib/utils";
export default function Notifications() {
  const { user, demo } = useAuth(); const cache = useQueryClient(); const [error, setError] = useState("");
  const list = useQuery({ queryKey: ["notifications", user?.id], queryFn: notifications,
    enabled: !!user && !demo, refetchInterval: 15000, retry: false });
  async function read(id: string) { try { await markRead(id); await cache.invalidateQueries({ queryKey: ["notifications"] }); } catch (e) { setError((e as Error).message); } }
  return <Shell title="Notificações" subtitle="Atualizações da prefeitura sobre seus registros. Até 100 notificações recentes.">
    {demo ? <p>Notificações reais ficam disponíveis após entrar na sua conta.</p> : list.isPending ? <p>Carregando…</p> : list.error ? <p role="alert">{list.error.message}</p> : <>
      {!list.data?.length && <p>Você ainda não recebeu atualizações.</p>}
      {list.data?.map(n => <article key={n.id} className={`panel form-section process-event ${!n.read_at ? "notification-unread" : ""}`}>
        <h2>{n.title}</h2><time>{dateLabel(n.created_at)}</time><p className="process-message">{n.message}</p>
        <div className="process-actions"><Link href={`/ocorrencias/${n.occurrence_id}`} onClick={() => void read(n.id)}>Ver acompanhamento</Link>
          {!n.read_at && <button onClick={() => void read(n.id)}>Marcar como lida</button>}</div>
      </article>)}
    </>}{error && <p role="alert">{error}</p>}
  </Shell>;
}

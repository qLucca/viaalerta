import { useState } from "react";
import { router, Redirect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen, Txt, Card, Button, Notice, Loading } from "../src/components/ui";
import { useAuth } from "../src/providers";
import { notifications, markRead } from "../src/lib/process";
export default function Notifications() {
 const { user, demo, loading } = useAuth(); const cache = useQueryClient(); const [error, setError] = useState("");
 const list = useQuery({ queryKey: ["notifications", user?.id], queryFn: notifications, enabled: !!user && !demo, refetchInterval: 15000, retry: false });
 async function read(id: string) { try { await markRead(id); await cache.invalidateQueries({ queryKey: ["notifications"] }); } catch (e) { setError((e as Error).message); } }
 if (loading) return <Loading />; if (!user) return <Redirect href="/login" />;
 return <Screen title="Notificações" subtitle="Até 100 atualizações recentes dos seus registros." back>
  {demo ? <Notice text="Entre na conta real para receber atualizações." /> : list.isPending ? <Loading /> : list.error ? <Notice error text={list.error.message} /> : <>
   {!list.data?.length && <Txt>Você ainda não recebeu atualizações.</Txt>}
   {list.data?.map(n => <Card key={n.id}><Txt style={{ fontWeight: "700" }}>{!n.read_at ? "● " : ""}{n.title}</Txt><Txt muted>{new Date(n.created_at).toLocaleString("pt-BR")}</Txt><Txt style={{ marginTop: 12 }}>{n.message}</Txt>
    <Button title="Ver acompanhamento" onPress={() => { void read(n.id); router.push({ pathname: "/ocorrencia/[id]", params: { id: n.occurrence_id } }); }} />
    {!n.read_at && <Button title="Marcar como lida" outline onPress={() => void read(n.id)} />}
   </Card>)}
  </>}{!!error && <Notice error text={error} />}
 </Screen>;
}

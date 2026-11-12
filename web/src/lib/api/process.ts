import { supabase } from "../supabase/client.ts";
import { canManage, transitions, type UserRole } from "../workflow.ts";
export { canManage, transitions, type UserRole };
export type ProcessUpdate = {
  id: string;
  occurrence_id: string;
  status: string;
  message: string;
  intervention_date: string | null;
  actor_role: string;
  version: number;
  created_at: string;
  after_image_path?: string | null;
  rejection_reason?: string | null;
  previous_status?: string | null;
};
export type AppNotification = {
  id: string;
  occurrence_id: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};
export function processError(
  error: { code?: string; message?: string } | null,
) {
  if (error?.code === "40001")
    return "Outra pessoa atualizou este processo. Recarregue antes de salvar.";
  if (error?.code === "42501")
    return "Acesso não permitido. Confira o município, a aprovação e a verificação em duas etapas.";
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error?.code || ""))
    return "O acompanhamento ainda não foi habilitado no banco. Contate o administrador.";
  return "Não foi possível concluir a ação. Confira os dados e tente novamente.";
}

function db() {
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}
export async function myRole(): Promise<UserRole> {
  const { data, error } = await db().rpc("viaalerta_my_role");
  if (error) throw new Error(processError(error));
  return ["admin", "agent", "manager"].includes(data)
    ? (data as UserRole)
    : "cidadao";
}
export async function processHistory(id: string): Promise<ProcessUpdate[]> {
  const { data, error } = await db()
    .from("viaalerta_public_history")
    .select("*")
    .eq("occurrence_id", id)
    .order("version", { ascending: true })
    .limit(100);
  if (error) throw new Error(processError(error));
  return data || [];
}
export async function recordPermissions(id: string) {
  const { data, error } = await db().rpc("viaalerta_record_permissions", {
    p_id: id,
  });
  if (error) throw new Error(processError(error));
  return data as {
    can_edit: boolean;
    can_manage: boolean;
    version: number;
    cancelled: boolean;
    municipality: string | null;
  };
}
export async function publishUpdate(input: {
  id: string;
  status: string;
  message: string;
  date: string;
  version: number;
  after: string;
  reason: string;
  related: string;
}) {
  const { error } = await db().rpc("viaalerta_publish_update", {
    p_id: input.id,
    p_status: input.status,
    p_message: input.message.trim(),
    p_date: input.date || null,
    p_version: input.version,
    p_after: input.after || null,
    p_reason: input.reason || null,
    p_related: input.related || null,
  });
  if (error) throw new Error(processError(error));
}
export async function ownerChange(
  id: string,
  description: string,
  cancel: boolean,
  version: number,
) {
  const { error } = await db().rpc("viaalerta_owner_change", {
    p_id: id,
    p_description: description,
    p_cancel: cancel,
    p_version: version,
  });
  if(error?.code==="42501")throw new Error("Este registro não pode mais ser editado ou cancelado. Recarregue para conferir o andamento.");
  if (error) throw new Error(processError(error));
}
export async function accessAction(
  name: string,
  args: Record<string, unknown> = {},
) {
  const { data, error } = await db().rpc(name, args);
  if (error) throw new Error(processError(error));
  return data;
}
export async function notifications(): Promise<AppNotification[]> {
  const { data, error } = await db()
    .from("viaalerta_notifications")
    .select("id,occurrence_id,title,message,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(processError(error));
  return data || [];
}
export async function markRead(id: string) {
  const { error } = await db().rpc("viaalerta_mark_notification_read", {
    p_id: id,
  });
  if (error) throw new Error(processError(error));
}
export async function listStaff(): Promise<
  { user_id: string; email: string; role: UserRole }[]
> {
  const { data, error } = await db().rpc("viaalerta_list_staff");
  if (error) throw new Error(processError(error));
  return data || [];
}

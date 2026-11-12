import { supabase } from "./supabase";
import {
  canManage,
  transitions,
  workflowProblem,
  type UserRole,
} from "./workflow";
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
};
export type AppNotification = {
  id: string;
  occurrence_id: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
};
export const municipality = "Uberlândia/MG";
export function processError(
  error: { code?: string; message?: string } | null,
) {
  if (error?.code === "40001")
    return "Outra pessoa atualizou este processo. Recarregue antes de salvar.";
  if (error?.code === "42501")
    return "Confira a aprovação do município e a verificação em duas etapas.";
  if (["PGRST202", "42P01", "42883"].includes(error?.code || ""))
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
    .select(
      "id,occurrence_id,status,message,intervention_date,actor_role,version,created_at,after_image_path,rejection_reason",
    )
    .eq("occurrence_id", id)
    .order("version", { ascending: true })
    .limit(100);
  if (error) throw new Error(processError(error));
  return data || [];
}
export async function updateProcess(
  id: string,
  current: string,
  status: string,
  message: string,
  date: string,
  version: number,
  after: string,
  reason: string,
  related: string,
) {
  const problem = workflowProblem(
    current,
    status,
    message,
    date,
    after,
    reason,
    related,
  );
  if (problem) throw new Error(problem);
  const { error } = await db().rpc("viaalerta_publish_update", {
    p_id: id,
    p_status: status,
    p_message: message.trim(),
    p_date: date || null,
    p_version: version,
    p_after: after || null,
    p_reason: reason || null,
    p_related: related || null,
  });
  if (error) throw new Error(processError(error));
}
export async function recordPermissions(id: string) {
  const { data, error } = await db().rpc("viaalerta_record_permissions", {
    p_id: id,
  });
  if (error) throw new Error(processError(error));
  return data as {
    can_manage: boolean;
    can_edit: boolean;
    version: number;
    cancelled: boolean;
    municipality: string | null;
  };
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
export async function processSnapshot(id: string) {
  const { data, error } = await db()
    .from("viaalerta_occurrences")
    .select("id,status,workflow_version")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(processError(error));
  if (!data)
    throw new Error("Ocorrência não encontrada ou sem permissão de acesso.");
  return data as {
    id: string;
    status: import("../types").Status;
    workflow_version: number;
  };
}

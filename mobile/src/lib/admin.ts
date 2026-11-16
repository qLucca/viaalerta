import { supabase } from "./supabase";
import type { AccountState } from "./admin-rules";
export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  role: string;
  state: AccountState;
  until_at: string | null;
  reason: string | null;
  version: number;
  occurrences: number;
  reports_received: number;
};
export type AdminReport = {
  occurrence_id: string;
  reporter_id: string;
  reporter_email: string;
  author_id: string;
  author_email: string;
  reason: string;
  description: string;
  created_at: string;
  review_state: "pending" | "reviewing" | "resolved" | "dismissed";
  review_note: string;
  review_version: number;
  hidden: boolean;
};
export type AdminOverview = {
  users: number;
  confirmed_users: number;
  new_users_30d: number;
  restricted_users: number;
  occurrences: number;
  pending_reports: number;
};
export async function adminRpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!supabase) throw new Error("Entre com uma conta real.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    if (["PGRST202", "42883", "42P01"].includes(error.code))
      throw new Error(
        "Instale a migração administrativa 005 no banco para habilitar este painel.",
      );
    if (error.code === "42501")
      throw new Error(
        "Acesso restrito a administrador ativo com sessão verificada em duas etapas.",
      );
    if (error.code === "40001")
      throw new Error(
        "Outra pessoa alterou este item. Recarregue antes de salvar.",
      );
    if (error.code === "22023")
      throw new Error(error.message || "Confira os dados da ação.");
    throw new Error(
      "Não foi possível concluir a operação administrativa. Tente novamente.",
    );
  }
  return data as T;
}

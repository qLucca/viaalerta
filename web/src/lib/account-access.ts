export type AccountAccess = {
  state: "active" | "suspended" | "banned";
  until: string | null;
  reason: string | null;
};
type Client = {
  rpc: (
    name: string,
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
};
export async function accountAccess(client: Client): Promise<AccountAccess> {
  const { data, error } = await client.rpc("viaalerta_my_account_status");
  // Compatibilidade até instalar 005; contas só podem ser restringidas após a migração.
  if (error?.code === "PGRST202")
    return { state: "active", until: null, reason: null };
  if (
    error ||
    !data ||
    typeof data !== "object" ||
    !("state" in data) ||
    !["active", "suspended", "banned"].includes(String(data.state))
  )
    throw new Error(
      "Não foi possível conferir a situação da conta. Tente novamente.",
    );
  return data as AccountAccess;
}

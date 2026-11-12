const url = new URL(process.env.SUPABASE_URL || "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  email = process.argv[2];
if (
  url.protocol !== "https:" ||
  !url.hostname.endsWith(".supabase.co") ||
  !key ||
  !email ||
  email.endsWith(".test")
)
  throw new Error(
    "Informe SUPABASE_URL, a chave administrativa somente no terminal e o email real de uma conta previamente confirmada. Nenhuma conta de teste é criada.",
  );
const response = await fetch(
  new URL("/rest/v1/rpc/viaalerta_bootstrap_admin", url.origin),
  {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_email: email }),
  },
);
if (!response.ok)
  throw new Error(
    `Não foi possível preparar o primeiro administrador (HTTP ${response.status}). Confira a migração e se já existe um administrador.`,
  );
console.log(
  "Administrador inicial configurado. A conta ainda precisa verificar MFA para operar. Agentes e gestores devem solicitar aprovação pelo portal.",
);

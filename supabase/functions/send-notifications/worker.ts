type Job = {
  id: string;
  lock_token: string;
  email: string;
  title: string;
  message: string;
  occurrence_id: string;
  intervention_date: string | null;
};
type Database = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};
type Config = {
  secret?: string;
  apiKey?: string;
  from?: string;
  webUrl?: string;
};
function sameSecret(actual: string, expected: string) {
  const a = new TextEncoder().encode(actual),
    b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export function createWorker(
  config: Config,
  db: Database,
  send: typeof fetch = fetch,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST")
      return new Response("Método não permitido", { status: 405 });
    if (
      !config.secret ||
      !sameSecret(
        request.headers.get("authorization") || "",
        `Bearer ${config.secret}`,
      )
    )
      return new Response("Não autorizado", { status: 401 });
    let base: URL;
    try {
      base = new URL(config.webUrl || "");
      if (base.protocol !== "https:") throw Error();
    } catch {
      return new Response("Configure a URL HTTPS da aplicação", {
        status: 503,
      });
    }
    if (!config.apiKey || !config.from)
      return new Response("Configure o serviço de e-mail", { status: 503 });
    const jobs = await db.rpc("viaalerta_claim_emails");
    if (jobs.error) return new Response("Fila indisponível", { status: 503 });
    let sent = 0,
      failed = 0,
      unconfirmed = 0;
    for (const job of (jobs.data || []) as Job[]) {
      let providerId: string | null = null,
        error: string | null = null;
      try {
        if (!job.email || /\.(test|invalid|localhost)$/i.test(job.email))
          throw Error("Destinatário de teste ou inválido");
        const allowed = await db.rpc("viaalerta_delivery_allowed", {
          p_id: job.id,
          p_channel: "email",
          p_lock_token: job.lock_token,
          p_recipient: job.email,
        });
        if (allowed.error || allowed.data !== true)
          throw Error("Autorização indisponível ou retirada");
        const link = new URL(
          `/ocorrencias/${encodeURIComponent(job.occurrence_id)}`,
          base.origin,
        ).href;
        const date = job.intervention_date
          ? `\nPrevisão de intervenção: ${job.intervention_date.split("-").reverse().join("/")}. Sujeita a atualização.\n`
          : "";
        const response = await send("https://api.resend.com/emails", {
          method: "POST",
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `viaalerta-${job.id}`,
          },
          body: JSON.stringify({
            from: config.from,
            to: [job.email],
            subject: `ViaAlerta — ${job.title}`,
            text: `${job.title}\n\n${job.message}\n${date}\nAcompanhe seu registro: ${link}\n\nViaAlerta — projeto colaborativo. Não é um canal oficial da prefeitura.\nPreferências de comunicação: ${base.origin}/perfil`,
          }),
        });
        if (!response.ok)
          throw Error(`Provedor de e-mail respondeu HTTP ${response.status}`);
        const result = await response.json();
        if (typeof result.id !== "string")
          throw Error("Resposta inválida do provedor");
        providerId = result.id;
      } catch (e) {
        error = e instanceof Error ? e.message : "Falha no envio";
      }
      const saved = await db.rpc("viaalerta_finish_email", {
        p_id: job.id,
        p_lock_token: job.lock_token,
        p_provider_id: providerId,
        p_error: error,
      });
      if (saved.error || saved.data !== true) unconfirmed++;
      else if (error) failed++;
      else sent++;
    }
    return Response.json(
      { sent, failed, unconfirmed },
      { status: unconfirmed ? 503 : 200 },
    );
  };
}

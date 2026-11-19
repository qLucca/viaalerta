import { updateEmail } from "./email-template.ts";
import { providerRequest, type EmailProvider } from "./email-provider.ts";

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
  provider?: EmailProvider;
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
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
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
    const provider = config.provider || "resend";
    if (!["resend", "brevo"].includes(provider))
      return new Response("Provedor inválido", { status: 503 });
    try {
      providerRequest(
        provider,
        config.apiKey,
        config.from,
        "check@example.invalid",
        "00000000-0000-4000-8000-000000000001",
        { subject: "", text: "", html: "" },
      );
    } catch {
      return new Response("Configure um remetente válido", { status: 503 });
    }
    const ready = await db.rpc("viaalerta_email_worker_ready");
    if (ready.error || ready.data !== true)
      return new Response(
        "Aplique a atualização da fila de e-mail antes de ativar envios",
        { status: 503 },
      );
    const jobs = await db.rpc("viaalerta_claim_emails");
    if (jobs.error) return new Response("Fila indisponível", { status: 503 });
    let sent = 0,
      failed = 0,
      unconfirmed = 0;
    let deferred = 0;
    let blocked = "";
    let attempted = false;
    for (const job of (jobs.data || []) as Job[]) {
      let providerId: string | null = null,
        error: string | null = null;
      try {
        if (blocked) throw Error(blocked);
        if (!job.email || /\.(test|invalid|localhost)$/i.test(job.email))
          throw Error("Destinatário de teste ou inválido");
        const allowed = await db.rpc("viaalerta_delivery_allowed", {
          p_id: job.id,
          p_channel: "email",
          p_lock_token: job.lock_token,
          p_recipient: job.email,
        });
        if (allowed.error || allowed.data !== true)
          throw Error("cancelled: autorização indisponível ou retirada");
        if (attempted) await wait(600);
        attempted = true;
        const payload = providerRequest(
          provider,
          config.apiKey,
          config.from,
          job.email,
          job.id,
          updateEmail(job, base.origin),
        );
        let response: Response;
        try {
          response = await send(payload.url, {
            method: "POST",
            signal: AbortSignal.timeout(15000),
            headers: payload.headers,
            body: JSON.stringify(payload.body),
          });
        } catch {
          throw Error(
            "uncertain: resposta do provedor não recebida; revisar antes de reenviar",
          );
        }
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const code = body.name || body.code;
          if (
            [
              "daily_quota_exceeded",
              "monthly_quota_exceeded",
              "not_enough_credits",
            ].includes(code)
          )
            blocked =
              "deferred:quota: limite gratuito ou créditos indisponíveis";
          else if (response.status === 429)
            blocked = "deferred:rate: limite temporário de requisições";
          if (blocked) throw Error(blocked);
          if (response.status >= 500)
            throw Error(
              `uncertain: provedor respondeu HTTP ${response.status}; revisar antes de reenviar`,
            );
          if (
            code === "duplicate_parameter" &&
            /idempotency/i.test(String(body.message))
          )
            throw Error(
              "uncertain: provedor já processou a chave; revisar o aceite antes de reenviar",
            );
          throw Error(`Provedor de e-mail respondeu HTTP ${response.status}`);
        }
        const result = await response.json().catch(() => null);
        const acceptedId =
          provider === "brevo" ? result?.messageId : result?.id;
        if (typeof acceptedId !== "string" || !acceptedId)
          throw Error(
            "uncertain: aceite sem identificador válido; revisar antes de reenviar",
          );
        providerId = acceptedId;
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
      else if (error?.startsWith("deferred:")) deferred++;
      else if (error) failed++;
      else sent++;
    }
    return Response.json(
      { sent, failed, unconfirmed, deferred },
      { status: unconfirmed ? 503 : 200 },
    );
  };
}

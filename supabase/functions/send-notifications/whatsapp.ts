type Database = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};
type Job = {
  id: string;
  lock_token: string;
  whatsapp: string;
  title: string;
  occurrence_id: string;
};
type Config = {
  secret?: string;
  token?: string;
  phoneId?: string;
  version?: string;
  template?: string;
  language?: string;
  webUrl?: string;
};

export function createWhatsappWorker(
  config: Config,
  db: Database,
  send: typeof fetch = fetch,
) {
  return async (request: Request) => {
    if (request.method !== "POST")
      return new Response("Método não permitido", { status: 405 });
    if (
      !config.secret ||
      request.headers.get("authorization") !== `Bearer ${config.secret}`
    )
      return new Response("Não autorizado", { status: 401 });
    if (
      !config.token ||
      !/^\d+$/.test(config.phoneId || "") ||
      !/^v\d+\.\d+$/.test(config.version || "") ||
      !/^[a-z0-9_]+$/.test(config.template || "") ||
      !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(config.language || "")
    )
      return new Response(
        "Configure o WhatsApp Business e um modelo aprovado",
        { status: 503 },
      );
    let base: URL;
    try {
      base = new URL(config.webUrl || "");
      if (base.protocol !== "https:") throw Error();
    } catch {
      return new Response("Configure a URL HTTPS da aplicação", {
        status: 503,
      });
    }
    const claimed = await db.rpc("viaalerta_claim_whatsapp");
    if (claimed.error)
      return new Response("Fila indisponível", { status: 503 });
    let accepted = 0,
      failed = 0,
      unconfirmed = 0;
    for (const job of (claimed.data || []) as Job[]) {
      let providerId: string | null = null,
        error: string | null = null;
      try {
        if (!/^\+[1-9]\d{7,14}$/.test(job.whatsapp))
          throw Error("cancelled: destinatário inválido");
        const allowed = await db.rpc("viaalerta_delivery_allowed", {
          p_id: job.id,
          p_channel: "whatsapp",
          p_lock_token: job.lock_token,
          p_recipient: job.whatsapp,
        });
        if (allowed.error || allowed.data !== true)
          throw Error("cancelled: autorização indisponível ou retirada");
        const link = new URL(
          `/ocorrencias/${encodeURIComponent(job.occurrence_id)}`,
          base.origin,
        ).href;
        let response: Response;
        try {
          response = await send(
            `https://graph.facebook.com/${config.version}/${config.phoneId}/messages`,
            {
              method: "POST",
              signal: AbortSignal.timeout(15000),
              headers: {
                Authorization: `Bearer ${config.token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: job.whatsapp.slice(1),
                type: "template",
                template: {
                  name: config.template,
                  language: { code: config.language },
                  components: [
                    {
                      type: "body",
                      parameters: [
                        { type: "text", text: job.title },
                        { type: "text", text: link },
                      ],
                    },
                  ],
                },
              }),
            },
          );
        } catch {
          throw Error(
            "uncertain: resposta de envio desconhecida; revisão manual necessária",
          );
        }
        if (!response.ok)
          throw Error(`Provedor respondeu HTTP ${response.status}`);
        let result;
        try {
          result = await response.json();
        } catch {
          throw Error("uncertain: resposta inválida do provedor");
        }
        if (typeof result.messages?.[0]?.id !== "string")
          throw Error("uncertain: confirmação do provedor ausente");
        providerId = result.messages[0].id;
      } catch (e) {
        error = e instanceof Error ? e.message : "Falha no envio";
      }
      const saved = await db.rpc("viaalerta_finish_whatsapp", {
        p_id: job.id,
        p_lock_token: job.lock_token,
        p_provider_id: providerId,
        p_error: error,
      });
      if (saved.error || saved.data !== true) unconfirmed++;
      else if (error) failed++;
      else accepted++;
    }
    return Response.json(
      { accepted, failed, unconfirmed },
      { status: unconfirmed ? 503 : 200 },
    );
  };
}

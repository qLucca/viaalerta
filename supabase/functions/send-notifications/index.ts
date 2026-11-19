import { createClient } from "npm:@supabase/supabase-js@2.80.0";
import { createWorker } from "./worker.ts";
import { createWhatsappWorker } from "./whatsapp.ts";
import type { EmailProvider } from "./email-provider.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = {
  rpc: async (name: string, args?: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args);
    return { data, error };
  },
};
const email = createWorker(
  {
    provider: (Deno.env.get("EMAIL_PROVIDER") || "resend") as EmailProvider,
    secret: Deno.env.get("NOTIFICATIONS_CRON_SECRET"),
    apiKey:
      Deno.env.get("EMAIL_PROVIDER") === "brevo"
        ? Deno.env.get("BREVO_API_KEY")
        : Deno.env.get("RESEND_API_KEY"),
    from: Deno.env.get("NOTIFICATIONS_FROM"),
    webUrl: Deno.env.get("NOTIFICATIONS_WEB_URL"),
  },
  db,
);
const whatsapp = createWhatsappWorker(
  {
    secret: Deno.env.get("NOTIFICATIONS_CRON_SECRET"),
    token: Deno.env.get("WHATSAPP_ACCESS_TOKEN"),
    phoneId: Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"),
    version: Deno.env.get("WHATSAPP_GRAPH_VERSION"),
    template: Deno.env.get("WHATSAPP_TEMPLATE_NAME"),
    language: Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE"),
    webUrl: Deno.env.get("NOTIFICATIONS_WEB_URL"),
  },
  db,
);
Deno.serve((request) => {
  const channel = new URL(request.url).searchParams.get("channel");
  if (channel === "whatsapp") return whatsapp(request);
  if (channel && channel !== "email")
    return new Response("Canal inválido", { status: 400 });
  return email(request);
});

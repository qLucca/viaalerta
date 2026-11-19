import { updateEmail } from "./email-template.ts";

export type EmailProvider = "resend" | "brevo";
type Email = ReturnType<typeof updateEmail>;

export function providerRequest(
  provider: EmailProvider,
  key: string,
  from: string,
  recipient: string,
  id: string,
  email: Email,
): { url: string; headers: Record<string, string>; body: unknown } {
  if (provider === "resend")
    return {
      url: "https://api.resend.com/emails",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `viaalerta-${id}`,
      },
      body: { from, to: [recipient], ...email },
    };
  const match = from
    .trim()
    .match(/^(?:(.+?)\s*<)?([^<>\s]+@[^<>\s]+\.[^<>\s]+)>?$/);
  if (!match || /[\r\n]/.test(from))
    throw Error("Configure um remetente de e-mail válido.");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw Error("Identificador de notificação inválido.");
  return {
    url: "https://api.brevo.com/v3/smtp/email",
    headers: {
      "api-key": key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: {
      sender: { email: match[2], name: match[1]?.trim() || "ViaAlerta" },
      to: [{ email: recipient }],
      subject: email.subject,
      textContent: email.text,
      htmlContent: email.html,
      headers: { idempotencyKey: id },
    },
  };
}

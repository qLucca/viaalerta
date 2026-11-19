type Update = {
  title: string;
  message: string;
  occurrence_id: string;
  intervention_date: string | null;
};

function escape(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}

export function updateEmail(update: Update, origin: string) {
  const base = new URL(origin);
  if (base.protocol !== "https:")
    throw new Error("Use a origem HTTPS do site.");
  const link = new URL(
    `/ocorrencias/${encodeURIComponent(update.occurrence_id)}`,
    base.origin,
  ).href;
  const preferences = `${base.origin}/perfil`;
  const date = update.intervention_date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const forecast = date
    ? `Previsão de intervenção: ${date[3]}/${date[2]}/${date[1]}. Sujeita a atualização.`
    : "";
  const subject = `ViaAlerta — ${update.title.replace(/[\r\n]/g, " ").slice(0, 160)}`;
  const footer =
    "ViaAlerta — projeto colaborativo. Não é um canal oficial da prefeitura.";
  return {
    subject,
    text: `${update.title}\n\n${update.message}\n\n${forecast}\n\nAcompanhe seu registro: ${link}\n\n${footer}\nPreferências de comunicação: ${preferences}`,
    html: `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f5f8f6;color:#183b30;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:600px;margin:24px auto;padding:24px;background:#fff;border:1px solid #d5e1db;border-radius:12px"><p style="font-weight:bold">ViaAlerta</p><h1 style="font-size:24px">${escape(update.title)}</h1><p style="white-space:pre-wrap">${escape(update.message)}</p>${forecast ? `<p><strong>${escape(forecast)}</strong></p>` : ""}<p><a href="${escape(link)}" style="display:inline-block;background:#247d61;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Acompanhar ocorrência</a></p><p style="font-size:13px">${escape(footer)}</p><p style="font-size:13px">Você autorizou receber atualizações dos seus registros. <a href="${escape(preferences)}" style="color:#185b46">Alterar preferências de e-mail</a>.</p></main></body></html>`,
  };
}

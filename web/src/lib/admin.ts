export type AccountState = "active" | "suspended" | "banned";
export const accountLabels: Record<AccountState, string> = {
  active: "Ativo",
  suspended: "Suspenso",
  banned: "Banido",
};
export const auditActionLabels: Record<string, string> = {
  "user.active": "Restrição de conta removida",
  "user.suspended": "Conta suspensa",
  "user.banned": "Conta banida",
  "report.reviewing": "Denúncia em análise",
  "report.resolved": "Denúncia resolvida",
  "report.dismissed": "Denúncia arquivada",
  "access.review": "Acesso institucional revisado",
  "access.revoke": "Acesso institucional revogado",
  "record.moderate": "Visibilidade de registro alterada",
  "record.create": "Registro criado",
  "record.edit": "Registro editado",
  "record.cancel": "Registro cancelado",
  "process.update": "Andamento atualizado",
};
export const reportLabels = {
  pending: "Recebida",
  reviewing: "Em análise",
  resolved: "Resolvida",
  dismissed: "Arquivada",
} as const;
export const reportReasons: Record<string, string> = {
  dados_pessoais: "Dados pessoais",
  conteudo_inadequado: "Conteúdo inadequado",
  local_incorreto: "Local incorreto",
  outro: "Outro motivo",
};
export function restrictionProblem(
  state: AccountState,
  reason: string,
  until: string,
  now = Date.now(),
) {
  if (!["active", "suspended", "banned"].includes(state))
    return "Escolha uma ação válida.";
  if (reason.trim().length < 5 || reason.trim().length > 1000)
    return "Descreva o motivo com 5 a 1.000 caracteres.";
  if (state === "suspended") {
    const time = Date.parse(until);
    if (!Number.isFinite(time) || time <= now || time > now + 365 * 86400000)
      return "Escolha um prazo futuro de até 365 dias.";
  }
  return "";
}

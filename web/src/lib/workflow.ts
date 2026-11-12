export type UserRole = "cidadao" | "agent" | "manager" | "admin";
export const roleLabels: Record<UserRole, string> = {
  cidadao: "Cidadão",
  agent: "Agente municipal",
  manager: "Gestor municipal",
  admin: "Administrador",
};
export function canManage(role: string) {
  return ["agent", "manager", "admin"].includes(role);
}
export function requiresMfa(role: string) {
  return ["manager", "admin"].includes(role);
}
export const transitions: Record<string, string[]> = {
  pendente: ["em_analise", "rejeitado", "duplicado", "encaminhado"],
  em_analise: [
    "em_analise",
    "programado",
    "em_execucao",
    "resolvido",
    "rejeitado",
    "duplicado",
    "encaminhado",
  ],
  programado: [
    "programado",
    "em_analise",
    "em_execucao",
    "resolvido",
    "encaminhado",
  ],
  em_execucao: ["em_execucao", "em_analise", "resolvido", "encaminhado"],
  resolvido: ["em_analise"],
  rejeitado: ["em_analise"],
  duplicado: ["em_analise"],
  encaminhado: ["em_analise"],
};
export const rejectionReasons = {
  fora_escopo: "Fora do escopo do órgão",
  informacao_insuficiente: "Informação insuficiente",
  nao_identificado: "Problema não identificado no local",
  conteudo_inadequado: "Conteúdo inadequado",
};
export function workflowProblem(
  current: string,
  next: string,
  message: string,
  date: string,
  after: string,
  reason: string,
  related: string,
) {
  if (!transitions[current]?.includes(next))
    return "Esta mudança de situação não é permitida.";
  if (message.trim().length < 5 || message.trim().length > 2000)
    return "Escreva um comentário com 5 a 2000 caracteres.";
  if (next === "programado" && !date)
    return "Informe a data prevista da intervenção.";
  if (next === "resolvido" && !after)
    return "Anexe uma foto do serviço concluído.";
  if (next === "rejeitado" && !(reason in rejectionReasons))
    return "Escolha o motivo da rejeição.";
  if (
    next === "duplicado" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      related,
    )
  )
    return "Informe o número completo do registro principal.";
  return "";
}

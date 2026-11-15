export function normalizeWhatsapp(value: string): string {
  if (!value.trim()) return "";
  let digits = value.replace(/\D/g, "");
  if (!value.trim().startsWith("+") && [10, 11].includes(digits.length))
    digits = `55${digits}`;
  if (!/^[1-9]\d{7,14}$/.test(digits))
    throw new Error(
      "Informe o WhatsApp com DDI e DDD, por exemplo +55 34 99999-9999.",
    );
  return `+${digits}`;
}

export function passwordProblem(password: string, confirmation: string) {
  if (password.length < 12)
    return "Use uma senha com pelo menos 12 caracteres.";
  if (password.length > 128) return "Use até 128 caracteres.";
  if (password !== confirmation) return "As senhas precisam ser iguais.";
  return "";
}

// O Auth pode retornar SVG bruto ou uma data URL, conforme a versão do serviço.
export function authenticatorQr(value: string): string {
  if (value.startsWith("data:image/svg+xml")) return value;
  if (
    value.trimStart().startsWith("<svg") ||
    value.trimStart().startsWith("<?xml")
  )
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value)}`;
  throw new Error("Não foi possível exibir o QR Code. Tente novamente.");
}

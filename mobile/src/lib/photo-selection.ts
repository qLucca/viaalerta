export function resizeForPhoto(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw new Error("Não foi possível ler as dimensões da foto. Escolha outra imagem.");
  if (width * height > 200_000_000) throw new Error("A imagem é muito grande. Escolha uma fotografia menor.");
  return Math.max(width, height) > 2000 ? width >= height ? { width: 2000 } : { height: 2000 } : null;
}
export async function selectWithFallback<T extends { canceled: boolean }>(
  picker: (legacy: boolean) => Promise<T>, android: boolean,
): Promise<T> {
  try { return await picker(false); }
  catch (error) { if (android) return picker(true); throw error; }
}

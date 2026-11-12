import { supabase } from "../supabase/client.ts";
import { z } from "zod";
import type { Analysis } from "@/types";
import { parseAnalysis } from "../analysis-contract.ts";
export { parseAnalysis } from "../analysis-contract.ts";
export function validateImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Envie uma imagem JPG, PNG ou WebP.");
  if (file.size > 8 * 1024 * 1024)
    throw new Error("A imagem deve ter no máximo 8 MB.");
  if (!file.size) throw new Error("A imagem está vazia.");
}
export async function imageDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        const img = new Image();
        img.onload = () =>
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () =>
          reject(new Error("Não foi possível abrir esta imagem."));
        img.src = url;
      },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function analyzeImage(
  file: File,
  forceDemo: boolean,
  emptyDemo = false,
): Promise<Analysis> {
  validateImage(file);
  const dimensions = await imageDimensions(file);
  if (dimensions.width * dimensions.height > 40_000_000)
    throw new Error("Use uma imagem com até 40 megapixels.");
  const endpoint = process.env.NEXT_PUBLIC_DETECTION_API_URL;
  if (forceDemo || !endpoint) {
    await new Promise((resolve) => setTimeout(resolve, 850));
    return {
      simulated: true,
      image_width: dimensions.width,
      image_height: dimensions.height,
      detections: emptyDemo
        ? []
        : [
            {
              class_id: 0,
              class_name: "buraco",
              confidence: 0.94,
              bbox: [
                dimensions.width * 0.24,
                dimensions.height * 0.38,
                dimensions.width * 0.72,
                dimensions.height * 0.78,
              ],
            },
          ],
    };
  }
  const url = new URL(endpoint);
  const localDevelopment =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !localDevelopment)
    throw new Error(
      "Configure um endpoint HTTPS para proteger a fotografia e a sessão.",
    );
  const session = supabase ? await supabase.auth.getSession() : null;
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Entre na sua conta para analisar uma foto.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body,
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        `A análise falhou (HTTP ${response.status}). Tente novamente.`,
      );
    return parseAnalysis(
      await response.json(),
      dimensions.width,
      dimensions.height,
    );
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("A análise excedeu 30 segundos. Tente novamente.");
    if (error instanceof z.ZodError)
      throw new Error(
        "A resposta da API não corresponde ao contrato esperado.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

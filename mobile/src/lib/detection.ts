import { supabase } from "./supabase";
import type { Analysis, Photo } from "../types";
import {
  parseAnalysis,
  simulatedAnalysis,
  assertPhoto,
} from "./detection-contract";
import { multipartPhoto } from "./photos";
export const mockDetection = !process.env.EXPO_PUBLIC_DETECTION_API_URL;
export async function analyzePhoto(
  photo: Photo,
  demo: boolean,
  empty = false,
): Promise<Analysis> {
  assertPhoto(photo.size, photo.width, photo.height);
  const endpoint = process.env.EXPO_PUBLIC_DETECTION_API_URL;
  if (demo || !endpoint) {
    await new Promise((r) => setTimeout(r, 700));
    return simulatedAnalysis(photo.width, photo.height, empty);
  }
  if (!endpoint.startsWith("https://"))
    throw new Error(
      "Configure um endpoint HTTPS para proteger a fotografia enviada.",
    );
  const session = supabase ? await supabase.auth.getSession() : null;
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Entre na sua conta para analisar uma foto.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: await multipartPhoto(photo),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(`A análise falhou (HTTP ${response.status}).`);
    try {
      return parseAnalysis(await response.json(), photo.width, photo.height);
    } catch {
      throw new Error(
        "Resposta da API incompatível com o contrato ou com as dimensões da foto.",
      );
    }
  } catch (e) {
    if (controller.signal.aborted)
      throw new Error("A análise excedeu 30 segundos. Tente novamente.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

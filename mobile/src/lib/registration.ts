import { z } from "zod";
import { parseAnalysis } from "./detection-contract.ts";
import type { Analysis, Occurrence } from "../types";

export const problemTypes = {
  buraco: "Buraco",
  calcada: "Calçada quebrada",
  sinalizacao: "Sinalização",
  iluminacao: "Iluminação",
  bueiro: "Bueiro",
  alagamento: "Alagamento",
  outro: "Outro",
} as const;
export type ProblemType = keyof typeof problemTypes;
export type RegistrationData = {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  problem_type: ProblemType;
  immediate_danger: boolean;
  analysis_state: "completed" | "failed" | "not_requested";
  ai_feedback: "confirmed" | "corrected" | "not_verified";
  human_has_pothole: boolean | null;
  analysis: Analysis;
  consent: true;
};
const payloadSchema = z
  .object({
    id: z.string().uuid(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    description: z.string().max(1000),
    problem_type: z.enum([
      "buraco",
      "calcada",
      "sinalizacao",
      "iluminacao",
      "bueiro",
      "alagamento",
      "outro",
    ]),
    immediate_danger: z.boolean(),
    analysis_state: z.enum(["completed", "failed", "not_requested"]),
    ai_feedback: z.enum(["confirmed", "corrected", "not_verified"]),
    human_has_pothole: z.boolean().nullable(),
    consent: z.literal(true),
    analysis: z.unknown(),
  })
  .strict();
export function validateRegistration(
  value: unknown,
  width: number,
  height: number,
): RegistrationData {
  const data = payloadSchema.parse(value);
  const analysis = parseAnalysis(data.analysis, width, height);
  if (data.analysis_state !== "completed") {
    if (data.ai_feedback !== "not_verified" || analysis.detections.length)
      throw new Error(
        "Um registro sem análise não pode conter detecções da IA.",
      );
  } else {
    if (
      data.problem_type !== "buraco" ||
      data.human_has_pothole === null ||
      data.ai_feedback === "not_verified"
    )
      throw new Error("Confira o resultado da análise antes de enviar.");
    const agrees = analysis.detections.length > 0 === data.human_has_pothole;
    if ((data.ai_feedback === "confirmed") !== agrees)
      throw new Error("A confirmação não corresponde à correção informada.");
  }
  if (width > 1600 || height > 1600)
    throw new Error("Prepare a fotografia com lado maior de até 1600 pixels.");
  return { ...data, description: data.description.trim(), analysis };
}
export function distanceMeters(a: [number, number], b: [number, number]) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(b[0] - a[0]) / 2) ** 2 +
    Math.cos(rad(a[0])) *
      Math.cos(rad(b[0])) *
      Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return (
    6371000 *
    2 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function isOpen(status: string) {
  return !["resolvido", "rejeitado", "duplicado", "encaminhado"].includes(
    status,
  );
}
export function nearbyRecords(
  records: Occurrence[],
  point: [number, number],
  type: ProblemType,
) {
  return records
    .filter(
      (r) =>
        !r.cancelled_at &&
        !r.hidden_at &&
        isOpen(r.status) &&
        (r.problem_type || "buraco") === type,
    )
    .map((r) => ({
      ...r,
      distance_m: distanceMeters(point, [r.latitude, r.longitude]),
    }))
    .filter((r) => r.distance_m <= 30)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, 5);
}
export function missingRegistration(input: {
  photo: boolean;
  processing: boolean;
  reviewed: boolean;
  location: boolean;
  duplicatesResolved: boolean;
  consent: boolean;
}) {
  if (input.processing) return "Aguarde o preparo da foto e a análise.";
  if (!input.photo) return "Falta escolher uma foto.";
  if (!input.reviewed) return "Falta conferir a foto e o resultado da análise.";
  if (!input.location) return "Falta escolher e confirmar o local da foto.";
  if (!input.duplicatesResolved)
    return "Confira os registros próximos ou marque que é outro problema.";
  if (!input.consent)
    return "Falta autorizar a publicação da foto, do local e da observação.";
  return "";
}

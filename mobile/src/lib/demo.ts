import AsyncStorage from "@react-native-async-storage/async-storage";
import { Asset } from "expo-asset";
import { z } from "zod";
import type { Occurrence } from "../types";
const centers = [
  [-23.553, -46.655],
  [-23.548, -46.646],
  [-23.557, -46.641],
  [-23.563, -46.651],
  [-23.55, -46.635],
  [-23.54, -46.65],
  [-23.56, -46.665],
  [-23.545, -46.663],
  [-23.568, -46.64],
  [-23.535, -46.642],
  [-23.552, -46.671],
  [-23.57, -46.658],
];
export function seed(): Occurrence[] {
  return centers.map(([latitude, longitude], i) => ({
    id: `demo-${i + 1}`,
    latitude,
    longitude,
    image_path: "demo",
    image_url: Asset.fromModule(require("../../assets/demo-road.jpg")).uri,
    status: i % 5 === 0 ? "resolvido" : i % 3 === 0 ? "em_analise" : "pendente",
    description: [
      "Desnível próximo à faixa de pedestres.",
      "Buraco na pista, próximo ao cruzamento.",
      "Asfalto danificado na lateral da via.",
    ][i % 3],
    created_at: `2026-10-${String(31 - i).padStart(2, "0")}T14:00:00Z`,
    detection_count: 1,
    max_confidence: 0.94,
    image_width: 800,
    image_height: 500,
    simulated: true,
    detections: [
      {
        class_id: 0,
        class_name: "buraco",
        confidence: 0.94,
        bbox: [270, 210, 520, 390],
      },
    ],
  }));
}
const key = "viaalerta-android-demo-v1";
export async function readDemo(): Promise<Occurrence[]> {
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return seed();
  try {
    return z
      .array(
        z
          .object({
            id: z.string(),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            status: z.enum(["pendente", "em_analise", "resolvido"]),
            image_path: z.string(),
            created_at: z.string(),
            description: z.string(),
            detection_count: z.number().int().nonnegative(),
            max_confidence: z.number().min(0).max(1),
          })
          .passthrough(),
      )
      .parse(JSON.parse(stored)) as Occurrence[];
  } catch {
    throw new Error(
      "Os registros de demonstração estão corrompidos. Os dados foram preservados; use uma cópia de segurança para recuperá-los.",
    );
  }
}
export async function writeDemo(records: Occurrence[]) {
  await AsyncStorage.setItem(key, JSON.stringify(records));
}

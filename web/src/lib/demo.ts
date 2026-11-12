import type { Occurrence } from "@/types";
import { DEFAULT_CITY } from "./location.ts";
const offsets = [
  [0, 0],
  [0.004, 0.006],
  [-0.004, 0.008],
  [-0.008, 0],
  [0.002, 0.012],
  [0.012, 0.004],
  [-0.006, -0.01],
  [0.008, -0.008],
  [-0.01, 0.01],
  [0.016, 0.012],
  [0, -0.016],
  [-0.014, -0.006],
];
const centers = offsets.map(([latitude, longitude]) => [
  DEFAULT_CITY.center[0] + latitude,
  DEFAULT_CITY.center[1] + longitude,
]);
const descriptions = [
  "Desnível próximo à faixa de pedestres.",
  "Buraco na pista, próximo ao cruzamento.",
  "Asfalto danificado na lateral da via.",
  "Atenção ao trecho próximo à ciclovia.",
];
export const demoSeed: Occurrence[] = centers.map(
  ([latitude, longitude], i) => ({
    id: `demo-${i + 1}`,
    latitude,
    longitude,
    image_path: "/demo-road.svg",
    image_url: "/demo-road.svg",
    status: i % 5 === 0 ? "resolvido" : i % 3 === 0 ? "em_analise" : "pendente",
    detection_count: 1,
    max_confidence: 0.94,
    description: descriptions[i % 4],
    created_at: `2026-10-${String(31 - i).padStart(2, "0")}T14:00:00Z`,
    simulated: true,
    image_width: 800,
    image_height: 500,
    detections: [
      {
        class_id: 0,
        class_name: "buraco",
        confidence: 0.94,
        bbox: [270, 210, 520, 390],
      },
    ],
  }),
);
const key = "viaalerta-demo-records-v1";
export function readDemo(): Occurrence[] {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : demoSeed;
  } catch {
    return demoSeed;
  }
}
export function saveDemo(records: Occurrence[]) {
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch {
    throw new Error(
      "O armazenamento local está cheio ou indisponível. Use uma foto menor ou libere espaço nas configurações do navegador.",
    );
  }
}

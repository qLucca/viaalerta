import type { Occurrence } from "@/types";
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

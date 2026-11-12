export type Status =
  | "pendente"
  | "em_analise"
  | "programado"
  | "em_execucao"
  | "resolvido"
  | "rejeitado"
  | "duplicado"
  | "encaminhado";
export type Detection = {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: [number, number, number, number];
};
export type Analysis = {
  detections: Detection[];
  image_width: number;
  image_height: number;
  simulated: boolean;
};
export type Occurrence = {
  id: string;
  latitude: number;
  longitude: number;
  image_path: string;
  image_url?: string;
  status: Status;
  workflow_version?: number;
  detection_count: number;
  max_confidence: number;
  description: string;
  created_at: string;
  updated_at?: string;
  detections?: Detection[];
  image_width?: number;
  image_height?: number;
  simulated?: boolean;
  problem_type?: import("@/lib/registration").ProblemType;
  immediate_danger?: boolean;
  analysis_state?: "completed" | "failed" | "not_requested" | "legacy";
  ai_feedback?: "confirmed" | "corrected" | "not_verified";
  human_has_pothole?: boolean | null;
  support_count?: number;
  owner_id?: string;
  cancelled_at?: string | null;
  hidden_at?: string | null;
};
export type Bounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};
export const statusLabels: Record<Status, string> = {
  pendente: "Reportado",
  em_analise: "Em análise",
  programado: "Intervenção programada",
  em_execucao: "Em execução",
  resolvido: "Resolvido",
  rejeitado: "Não aprovado",
  duplicado: "Duplicado",
  encaminhado: "Encaminhado a outro órgão",
};

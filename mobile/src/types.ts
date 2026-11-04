export type Status = "pendente" | "em_analise" | "resolvido";
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
export type Photo = {
  uri: string;
  width: number;
  height: number;
  size: number;
  name: string;
  mime: "image/jpeg";
};
export type Occurrence = {
  id: string;
  latitude: number;
  longitude: number;
  image_path: string;
  image_url?: string;
  status: Status;
  detection_count: number;
  max_confidence: number;
  description: string;
  created_at: string;
  image_width?: number;
  image_height?: number;
  detections?: Detection[];
  simulated?: boolean;
};
export type Bounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};
export type Point = [number, number];
export const statusLabels: Record<Status, string> = {
  pendente: "Reportado",
  em_analise: "Em análise",
  resolvido: "Resolvido",
};

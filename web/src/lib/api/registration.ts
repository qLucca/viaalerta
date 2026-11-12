import { supabase } from "../supabase/client.ts";
import { readDemo, saveDemo } from "../demo.ts";
import {
  nearbyRecords,
  validateRegistration,
  type RegistrationData,
  type ProblemType,
} from "../registration.ts";
import type { Occurrence } from "@/types";

export async function sessionToken() {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
  return token;
}
function rpcError(error: { code?: string } | null) {
  if (error?.code === "PGRST202" || error?.code === "42P01")
    return new Error(
      "O novo fluxo ainda não foi habilitado no banco. Contate o administrador.",
    );
  return new Error(
    "Não foi possível concluir a ação. Confira sua conexão e tente novamente.",
  );
}
export async function registerPhoto(
  file: File,
  data: RegistrationData,
  demo: boolean,
) {
  validateRegistration(
    data,
    data.analysis.image_width,
    data.analysis.image_height,
  );
  if (demo) {
    const existing = readDemo().find((r) => r.id === data.id);
    if (existing) return existing;
    if (
      readDemo().filter(
        (r) =>
          r.owner_id === "demo" &&
          Date.now() - Date.parse(r.created_at) < 600000,
      ).length >= 5
    )
      throw new Error(
        "Você já enviou cinco registros nos últimos dez minutos. Aguarde antes de enviar outro.",
      );
    const image_url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () =>
        reject(new Error("Não foi possível guardar a foto."));
      reader.readAsDataURL(file);
    });
    const record: Occurrence = {
      id: data.id,
      latitude: data.latitude,
      longitude: data.longitude,
      description: data.description,
      problem_type: data.problem_type,
      immediate_danger: data.immediate_danger,
      analysis_state: data.analysis_state,
      ai_feedback: data.ai_feedback,
      human_has_pothole: data.human_has_pothole,
      ...data.analysis,
      image_path: "local",
      image_url,
      status: "pendente",
      created_at: new Date().toISOString(),
      simulated: true,
      owner_id: "demo",
      support_count: 0,
      detection_count: data.analysis.detections.length,
      max_confidence: Math.max(
        0,
        ...data.analysis.detections.map((d) => d.confidence),
      ),
    };
    saveDemo([record, ...readDemo()]);
    return record;
  }
  const body = new FormData();
  body.append("file", file);
  body.append("data", JSON.stringify(data));
  const response = await fetch("/api/registrations", {
    method: "POST",
    headers: { Authorization: `Bearer ${await sessionToken()}` },
    body,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Não foi possível enviar o registro.");
  return { id: String(result.id), simulated: false };
}
export async function findNearby(
  point: [number, number],
  type: ProblemType,
  demo: boolean,
): Promise<(Occurrence & { distance_m: number })[]> {
  if (demo) return nearbyRecords(readDemo(), point, type);
  if (!supabase) throw new Error("Entre novamente.");
  const { data, error } = await supabase.rpc("viaalerta_nearby_records", {
    p_latitude: point[0],
    p_longitude: point[1],
    p_type: type,
  });
  if (error) throw rpcError(error);
  return (data || []).map((r: Occurrence & { distance_m: number }) => ({
    ...r,
    image_url: supabase!.storage
      .from("viaalerta-images")
      .getPublicUrl(r.image_path).data.publicUrl,
  }));
}
export async function supportRecord(id: string, demo: boolean) {
  if (demo) {
    const records = readDemo(),
      record = records.find((r) => r.id === id);
    if (!record) throw new Error("Registro não encontrado.");
    if (record.owner_id === "demo")
      throw new Error(
        "Este registro já é seu. Acompanhe-o na lista de registros.",
      );
    if (["resolvido", "rejeitado"].includes(record.status))
      throw new Error("Este registro já foi encerrado.");
    const key = "viaalerta-demo-supports-v1",
      supported: string[] = JSON.parse(localStorage.getItem(key) || "[]");
    if (supported.includes(id)) return;
    saveDemo(
      records.map((r) =>
        r.id === id ? { ...r, support_count: (r.support_count || 0) + 1 } : r,
      ),
    );
    localStorage.setItem(key, JSON.stringify([...supported, id]));
    return;
  }
  if (!supabase) throw new Error("Entre novamente.");
  const { error } = await supabase.rpc("viaalerta_support_record", {
    p_id: id,
  });
  if (error) {
    if (error.code === "22023")
      throw new Error(
        "Este registro é seu ou já foi encerrado. Abra o acompanhamento.",
      );
    throw rpcError(error);
  }
}
export async function reportRecord(
  id: string,
  reason: string,
  description: string,
  demo: boolean,
) {
  if (demo) return;
  if (!supabase) throw new Error("Entre novamente.");
  const { error } = await supabase.rpc("viaalerta_report_record", {
    p_id: id,
    p_reason: reason,
    p_description: description,
  });
  if (error) throw rpcError(error);
}

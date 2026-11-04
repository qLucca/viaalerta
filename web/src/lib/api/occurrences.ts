import { supabase } from "../supabase/client.ts";
import { readDemo, saveDemo } from "../demo.ts";
import type { Analysis, Bounds, Occurrence, Status } from "@/types";
export async function listOccurrences(
  demo: boolean,
  options: {
    bounds?: Bounds;
    status?: Status;
    mine?: boolean;
    id?: string;
    offset?: number;
    limit?: number;
    oldest?: boolean;
  } = {},
) {
  const offset = Math.max(0, Math.trunc(options.offset || 0));
  const limit = Math.min(500, Math.max(1, Math.trunc(options.limit || 500)));
  if (demo) {
    return readDemo()
      .filter(
        (r) =>
          (!options.id || r.id === options.id) &&
          (!options.status || r.status === options.status) &&
          (!options.bounds ||
            (r.latitude >= options.bounds.south &&
              r.latitude <= options.bounds.north &&
              r.longitude >= options.bounds.west &&
              r.longitude <= options.bounds.east)),
      )
      .sort((a, b) =>
        options.oldest
          ? a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
          : b.created_at.localeCompare(a.created_at) ||
            b.id.localeCompare(a.id),
      )
      .slice(offset, offset + limit);
  }
  if (!supabase) throw new Error("Supabase não configurado.");
  let query = supabase
    .from(
      options.mine ? "viaalerta_occurrences" : "viaalerta_public_occurrences",
    )
    .select(
      "id,latitude,longitude,image_path,status,detection_count,max_confidence,description,created_at,image_width,image_height,detections",
    )
    .order("created_at", { ascending: !!options.oldest })
    .order("id", { ascending: !!options.oldest });
  if (options.mine) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Entre para ver seus registros.");
    query = query.eq("user_id", user.id);
  }
  if (options.status) query = query.eq("status", options.status);
  if (options.id) query = query.eq("id", options.id);
  if (options.bounds)
    query = query
      .gte("latitude", options.bounds.south)
      .lte("latitude", options.bounds.north)
      .gte("longitude", options.bounds.west)
      .lte("longitude", options.bounds.east);
  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error)
    throw new Error(
      "Não foi possível carregar os registros. Confira a conexão e tente novamente.",
    );
  const all = data as Occurrence[];
  return all.map((r) => ({
    ...r,
    image_url: supabase!.storage
      .from("viaalerta-images")
      .getPublicUrl(r.image_path).data.publicUrl,
  }));
}
export async function getOccurrence(id: string, demo: boolean) {
  const records = await listOccurrences(demo, { id });
  return records[0];
}
export async function createOccurrence(
  file: File,
  analysis: Analysis,
  latitude: number,
  longitude: number,
  description: string,
  demoSession: boolean,
) {
  if (analysis.simulated || demoSession) {
    const image_url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Falha ao ler a foto."));
      reader.readAsDataURL(file);
    });
    const record: Occurrence = {
      id: crypto.randomUUID(),
      latitude,
      longitude,
      image_path: "local",
      image_url,
      status: "pendente",
      detection_count: analysis.detections.length,
      max_confidence: Math.max(
        0,
        ...analysis.detections.map((d) => d.confidence),
      ),
      description,
      created_at: new Date().toISOString(),
      ...analysis,
      simulated: true,
    };
    saveDemo([record, ...readDemo()]);
    return record;
  }
  if (!supabase) throw new Error("Supabase não configurado.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
  const id = crypto.randomUUID();
  const extension = (
    { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<
      string,
      string
    >
  )[file.type];
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("Não foi possível preparar a imagem.")),
      file.type,
      0.9,
    ),
  );
  const image_path = `${user.id}/${id}.${extension}`;
  const upload = await supabase.storage
    .from("viaalerta-images")
    .upload(image_path, blob, { contentType: file.type });
  if (upload.error) throw upload.error;
  const { error } = await supabase.from("viaalerta_occurrences").insert({
    id,
    user_id: user.id,
    latitude,
    longitude,
    image_path,
    status: "pendente",
    detection_count: analysis.detections.length,
    max_confidence: Math.max(
      0,
      ...analysis.detections.map((d) => d.confidence),
    ),
    description,
    image_width: analysis.image_width,
    image_height: analysis.image_height,
    detections: analysis.detections,
  });
  if (error) {
    const cleanup = await supabase.storage
      .from("viaalerta-images")
      .remove([image_path]);
    if (cleanup.error)
      console.warn("Falha ao remover a fotografia de um registro não salvo.");
    throw error;
  }
  return { id, simulated: false };
}

export async function countOccurrences(
  demo: boolean,
  options: { mine?: boolean; status?: Status } = {},
) {
  if (demo)
    return readDemo().filter(
      (r) => !options.status || r.status === options.status,
    ).length;
  if (!supabase) throw new Error("Supabase não configurado.");
  let query = supabase
    .from(
      options.mine ? "viaalerta_occurrences" : "viaalerta_public_occurrences",
    )
    .select("id", { count: "exact", head: true });
  if (options.mine) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Entre para ver seus registros.");
    query = query.eq("user_id", user.id);
  }
  if (options.status) query = query.eq("status", options.status);
  const { count, error } = await query;
  if (error)
    throw new Error("Não foi possível consultar a contagem de registros.");
  return count || 0;
}
export async function occurrenceSummary(demo: boolean) {
  const [total, pendente, em_analise, resolvido] = await Promise.all([
    countOccurrences(demo),
    countOccurrences(demo, { status: "pendente" }),
    countOccurrences(demo, { status: "em_analise" }),
    countOccurrences(demo, { status: "resolvido" }),
  ]);
  return { total, pendente, em_analise, resolvido };
}

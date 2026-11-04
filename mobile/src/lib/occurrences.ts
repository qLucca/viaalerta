import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { readDemo, writeDemo } from "./demo";
import { persistDemoPhoto } from "./demo-file";
import { photoBytes } from "./photos";
import type {
  Analysis,
  Bounds,
  Occurrence,
  Photo,
  Point,
  Status,
} from "../types";
const table = "viaalerta_occurrences";
const view = "viaalerta_public_occurrences";
const bucket = "viaalerta-images";
export async function listOccurrences(
  demo: boolean,
  options: {
    mine?: boolean;
    bounds?: Bounds;
    status?: Status;
    id?: string;
    offset?: number;
    limit?: number;
    oldest?: boolean;
  } = {},
) {
  const offset = Math.max(0, Math.trunc(options.offset || 0));
  const limit = Math.min(500, Math.max(1, Math.trunc(options.limit || 500)));
  if (demo)
    return (await readDemo())
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
  if (!supabase) throw new Error("Supabase não configurado.");
  let query = supabase
    .from(options.mine ? table : view)
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
    image_url: supabase!.storage.from(bucket).getPublicUrl(r.image_path).data
      .publicUrl,
    description: r.description || "",
  }));
}
export async function saveOccurrence(
  photo: Photo,
  analysis: Analysis,
  point: Point,
  description: string,
  demo: boolean,
) {
  const id = Crypto.randomUUID();
  const common = {
    id,
    latitude: point[0],
    longitude: point[1],
    description,
    status: "pendente" as const,
    detection_count: analysis.detections.length,
    max_confidence: Math.max(
      0,
      ...analysis.detections.map((d) => d.confidence),
    ),
    image_width: analysis.image_width,
    image_height: analysis.image_height,
    detections: analysis.detections,
  };
  if (demo || analysis.simulated) {
    const image_url = await persistDemoPhoto(photo.uri, id);
    await writeDemo([
      {
        ...common,
        image_path: "local",
        image_url,
        created_at: new Date().toISOString(),
        simulated: true,
      },
      ...(await readDemo()),
    ]);
    return { id, local: true };
  }
  if (!supabase) throw new Error("Supabase não configurado.");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
  const image_path = `${user.id}/${id}.jpg`;
  const upload = await supabase.storage
    .from(bucket)
    .upload(image_path, await photoBytes(photo), { contentType: "image/jpeg" });
  if (upload.error)
    throw new Error("Não foi possível enviar a fotografia. Tente novamente.");
  const { error } = await supabase
    .from(table)
    .insert({ ...common, user_id: user.id, image_path });
  if (error) {
    const cleanup = await supabase.storage.from(bucket).remove([image_path]);
    if (cleanup.error)
      console.warn("Falha ao remover a fotografia de um registro não salvo.");
    throw new Error("Não foi possível salvar o registro. Tente novamente.");
  }
  return { id, local: false };
}

export async function countOccurrences(
  demo: boolean,
  options: { mine?: boolean; status?: Status } = {},
) {
  if (demo)
    return (await readDemo()).filter(
      (r) => !options.status || r.status === options.status,
    ).length;
  if (!supabase) throw new Error("Supabase não configurado.");
  let query = supabase
    .from(options.mine ? table : view)
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

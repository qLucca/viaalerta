import { supabase } from "../supabase/client.ts";
import { readDemo } from "../demo.ts";
import type { Bounds, Occurrence, Status } from "@/types";
export async function listOccurrences(
  demo: boolean,
  options: {
    bounds?: Bounds;
    status?: Status;
    mine?: boolean;
    staff?: boolean;
    id?: string;
    offset?: number;
    limit?: number;
    oldest?: boolean;
    type?: string;
    since?: string;
    publicOnly?: boolean;
  } = {},
  legacyColumns = false,
): Promise<Occurrence[]> {
  const offset = Math.max(0, Math.trunc(options.offset || 0));
  const limit = Math.min(500, Math.max(1, Math.trunc(options.limit || 500)));
  if (demo) {
    return readDemo()
      .filter(
        (r) =>
          (!options.mine || r.owner_id === "demo") &&
          ((options.mine && !options.publicOnly) ||
            (!r.cancelled_at && !r.hidden_at)) &&
          (!options.type || (r.problem_type || "buraco") === options.type) &&
          (!options.since ||
            Date.parse(r.created_at) >= Date.parse(options.since)) &&
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
      options.mine || options.staff
        ? "viaalerta_occurrences"
        : "viaalerta_public_occurrences",
    )
    .select(
      "id,latitude,longitude,image_path,status,detection_count,max_confidence,description,created_at,image_width,image_height,detections" +
        (legacyColumns
          ? ""
          : ",problem_type,analysis_state" +
            (options.mine || options.staff ? ",cancelled_at,hidden_at" : "")),
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
  if (options.publicOnly && !legacyColumns && (options.mine || options.staff))
    query = query.is("cancelled_at", null).is("hidden_at", null);
  if (options.id) query = query.eq("id", options.id);
  if (options.type) query = query.eq("problem_type", options.type);
  if (options.since) query = query.gte("created_at", options.since);
  if (options.bounds)
    query = query
      .gte("latitude", options.bounds.south)
      .lte("latitude", options.bounds.north)
      .gte("longitude", options.bounds.west)
      .lte("longitude", options.bounds.east);
  const { data, error } = await query.range(offset, offset + limit - 1);
  // A consulta antiga continua disponível até a migração do novo fluxo ser aplicada.
  if (error && !legacyColumns && ["42703", "PGRST204"].includes(error.code))
    return listOccurrences(demo, options, true);
  if (error)
    throw new Error(
      "Não foi possível carregar os registros. Confira a conexão e tente novamente.",
    );
  const all = data as unknown as Occurrence[];
  return all.map((r) => ({
    ...r,
    image_url: supabase!.storage
      .from("viaalerta-images")
      .getPublicUrl(r.image_path).data.publicUrl,
  }));
}
export async function getOccurrence(id: string, demo: boolean) {
  const records = await listOccurrences(demo, { id });
  if (records[0]) return records[0];
  if (demo) return readDemo().find((r) => r.id === id && r.owner_id === "demo");
  const session = await supabase?.auth.getSession();
  if (session?.data.session)
    return (await listOccurrences(false, { id, staff: true }))[0];
  return undefined;
}
export async function countOccurrences(
  demo: boolean,
  options: { mine?: boolean; staff?: boolean; status?: Status } = {},
  legacy = false,
): Promise<number> {
  if (demo)
    return readDemo().filter(
      (r) =>
        (!options.mine || r.owner_id === "demo") &&
        !r.cancelled_at &&
        !r.hidden_at &&
        (!options.status || r.status === options.status),
    ).length;
  if (!supabase) throw new Error("Supabase não configurado.");
  let query = supabase
    .from(
      options.mine || options.staff
        ? "viaalerta_occurrences"
        : "viaalerta_public_occurrences",
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
  if (options.mine && !legacy) query = query.is("cancelled_at", null);
  const { count, error } = await query;
  if (error && !legacy && ["42703", "PGRST204"].includes(error.code))
    return countOccurrences(demo, options, true);
  if (error)
    throw new Error("Não foi possível consultar a contagem de registros.");
  return count || 0;
}
export async function occurrenceSummary(
  demo: boolean,
  scope: { mine?: boolean } = {},
) {
  const [total, pendente, em_analise, resolvido] = await Promise.all([
    countOccurrences(demo, scope),
    countOccurrences(demo, { ...scope, status: "pendente" }),
    countOccurrences(demo, { ...scope, status: "em_analise" }),
    countOccurrences(demo, { ...scope, status: "resolvido" }),
  ]);
  return { total, pendente, em_analise, resolvido };
}

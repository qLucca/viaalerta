import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { boundedForm, RequestError, sanitizePhoto } from "./registrations.ts";
import { accountAccess } from "../account-access.ts";
export function interventionHandler(
  factory: (url: string, key: string, token: string) => SupabaseClient = (
    url,
    key,
    token,
  ) =>
    createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
) {
  return async (request: Request) => {
    try {
      const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!token) throw new RequestError("Entre novamente.", 401);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
        key =
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new RequestError("Serviço não configurado.", 503);
      const db = factory(url, key, token),
        auth = await db.auth.getUser(token);
      if (auth.error || !auth.data.user)
        throw new RequestError("Sessão inválida.", 401);
      let access;
      try {
        access = await accountAccess(db);
      } catch {
        throw new RequestError(
          "Não foi possível conferir a situação da conta.",
          503,
        );
      }
      if (access.state !== "active")
        throw new RequestError("Conta suspensa ou banida do ViaAlerta.", 403);
      const form = await boundedForm(request),
        file = form.get("file"),
        id = form.get("id");
      if (
        !(file instanceof File) ||
        !file.size ||
        file.size > 8 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        typeof id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(id) ||
        form.get("consent") !== "true"
      )
        throw new RequestError("Confira a foto e a autorização de publicação.");
      const permission = await db.rpc("viaalerta_record_permissions", {
        p_id: id,
      });
      if (permission.error || !permission.data?.can_manage)
        throw new RequestError(
          "Acesso não autorizado para este município. Confira também a verificação em duas etapas.",
          403,
        );
      const { image } = await sanitizePhoto(file),
        path = `${auth.data.user.id}/${id}/${crypto.randomUUID()}.jpg`;
      const { error } = await db.storage
        .from("viaalerta-interventions")
        .upload(path, image, { contentType: "image/jpeg", upsert: false });
      if (error)
        throw new RequestError(
          "Não foi possível salvar a foto posterior.",
          503,
        );
      return Response.json({ path });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof RequestError
              ? error.message
              : "Não foi possível preparar a foto.",
        },
        { status: error instanceof RequestError ? error.status : 400 },
      );
    }
  };
}

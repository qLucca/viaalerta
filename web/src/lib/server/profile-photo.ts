import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { boundedForm, RequestError, sanitizePhoto } from "./registrations.ts";
import { accountAccess } from "../account-access.ts";

export function profilePhotoHandler(
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
    let cleanup: (() => Promise<unknown>) | undefined;
    try {
      const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!token)
        throw new RequestError("Entre novamente para enviar a foto.", 401);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new RequestError("Serviço não configurado.", 503);
      const db = factory(url, key, token);
      const auth = await db.auth.getUser(token);
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
        file = form.get("file");
      if (!(file instanceof File) || !file.size || file.size > 8 * 1024 * 1024)
        throw new RequestError("Escolha uma foto de até 8 MB após o preparo.");
      const sanitized = await sanitizePhoto(file);
      const image = await sharp(sanitized.image)
        .resize(320, 320, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toBuffer();
      const previous = await db.rpc("viaalerta_my_preferences");
      if (previous.error)
        throw new RequestError(
          "Atualize o banco para habilitar fotos de perfil.",
          503,
        );
      const path = `${auth.data.user.id}/${crypto.randomUUID()}.jpg`;
      const bucket = db.storage.from("viaalerta-avatars");
      const uploaded = await bucket.upload(path, image, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploaded.error)
        throw new RequestError("Não foi possível salvar sua foto.", 503);
      // Uma resposta perdida não comprova que a gravação falhou. Preserve a foto
      // quando nem a consulta de confirmação puder determinar o estado atual.
      let rollbackConfirmed = false;
      cleanup = async () => {
        if (!rollbackConfirmed) return;
        const current = await db.rpc("viaalerta_my_preferences");
        if (!current.error && current.data && current.data.avatar_path !== path)
          await bucket.remove([path]);
      };
      let confirmed = false;
      try {
        const saved = await db.rpc("viaalerta_set_avatar", { p_path: path });
        confirmed = !saved.error;
        rollbackConfirmed = /^(22|23|40|42)/.test(saved.error?.code || "");
      } catch {
        // A consulta abaixo resolve também erros de transporte após o commit.
      }
      if (!confirmed) {
        try {
          const current = await db.rpc("viaalerta_my_preferences");
          confirmed = !current.error && current.data?.avatar_path === path;
        } catch {
          confirmed = false;
        }
      }
      if (!confirmed)
        throw new RequestError(
          "Não foi possível confirmar a atualização da foto. Atualize a página antes de tentar novamente.",
          503,
        );
      cleanup = undefined;
      if (previous.data?.avatar_path)
        await bucket.remove([previous.data.avatar_path]).catch(() => {});
      return Response.json(
        { saved: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      if (cleanup) await cleanup().catch(() => {});
      return Response.json(
        {
          error:
            error instanceof RequestError
              ? error.message
              : "Não foi possível preparar a foto. Use JPG, PNG ou WebP.",
        },
        { status: error instanceof RequestError ? error.status : 400 },
      );
    }
  };
}

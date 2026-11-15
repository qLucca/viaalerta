import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { validateRegistration } from "../registration.ts";
import { accountAccess } from "../account-access.ts";

const LIMIT = 8 * 1024 * 1024,
  BODY_LIMIT = LIMIT + 64 * 1024;
export class RequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export async function boundedForm(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
    throw new RequestError("Envie a foto pelo formulário.");
  if (Number(request.headers.get("content-length")) > BODY_LIMIT)
    throw new RequestError("A foto deve ter até 8 MB após o preparo.", 413);
  if (!request.body) throw new RequestError("Escolha uma foto.");
  const reader = request.body.getReader(),
    parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > BODY_LIMIT) {
        await reader.cancel();
        throw new RequestError("A foto deve ter até 8 MB após o preparo.", 413);
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Response(Buffer.concat(parts), {
    headers: { "Content-Type": request.headers.get("content-type")! },
  }).formData();
}
export async function sanitizePhoto(file: File) {
  let image: Buffer, info: { width: number; height: number };
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(input, {
      limitInputPixels: 40000000,
      failOn: "warning",
    }).metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      `image/${meta.format === "jpeg" ? "jpeg" : meta.format}` !== file.type
    )
      throw new Error();
    const output = await sharp(input, {
      limitInputPixels: 40000000,
      failOn: "warning",
    })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    image = output.data;
    info = output.info;
  } catch {
    throw new RequestError(
      "A fotografia não é uma imagem válida. Escolha outro arquivo.",
    );
  }
  return { image, info };
}
export function registrationHandler(
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
      if (!token)
        throw new RequestError("Entre na sua conta antes de enviar.", 401);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
        key =
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key)
        throw new RequestError(
          "O serviço de registros não está configurado.",
          503,
        );
      const db = factory(url, key, token),
        auth = await db.auth.getUser(token);
      if (auth.error || !auth.data.user)
        throw new RequestError("Sua sessão expirou. Entre novamente.", 401);
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
        raw = form.get("data");
      if (
        !(file instanceof File) ||
        !file.size ||
        typeof raw !== "string" ||
        raw.length > 32000
      )
        throw new RequestError("Confira a foto e os dados do registro.");
      if (file.size > LIMIT)
        throw new RequestError("A foto deve ter até 8 MB após o preparo.", 413);
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new RequestError("Use JPG, PNG ou WebP.");
      const { image, info } = await sanitizePhoto(file);
      const data = validateRegistration(
        JSON.parse(raw),
        info.width,
        info.height,
      );
      const existing = await db
        .from("viaalerta_occurrences")
        .select("id")
        .eq("id", data.id)
        .eq("user_id", auth.data.user.id)
        .maybeSingle();
      if (existing.error)
        throw new RequestError(
          "Não foi possível consultar o registro. Tente novamente.",
          503,
        );
      if (existing.data) return Response.json({ id: data.id });
      const path = `${auth.data.user.id}/${data.id}.jpg`,
        bucket = db.storage.from("viaalerta-images");
      const upload = await bucket.upload(path, image, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upload.error)
        throw new RequestError(
          "Não foi possível guardar a foto. Tente novamente.",
          503,
        );
      const { error } = await db.from("viaalerta_occurrences").insert({
        id: data.id,
        user_id: auth.data.user.id,
        latitude: data.latitude,
        longitude: data.longitude,
        image_path: path,
        status: "pendente",
        description: data.description,
        problem_type: data.problem_type,
        immediate_danger: data.immediate_danger,
        analysis_state: data.analysis_state,
        ai_feedback: data.ai_feedback,
        human_has_pothole: data.human_has_pothole,
        detection_count: data.analysis.detections.length,
        max_confidence: Math.max(
          0,
          ...data.analysis.detections.map((d) => d.confidence),
        ),
        image_width: info.width,
        image_height: info.height,
        detections: data.analysis.detections,
      });
      if (error) {
        // A confirmação pode ter se perdido na rede; não apague a foto de um registro já salvo.
        const saved = await db
          .from("viaalerta_occurrences")
          .select("id")
          .eq("id", data.id)
          .eq("user_id", auth.data.user.id)
          .maybeSingle();
        if (saved.data) return Response.json({ id: data.id });
        if (!saved.error) await bucket.remove([path]);
        if (error.code === "P0001")
          throw new RequestError(
            "Você atingiu o limite de envios. Aguarde antes de registrar outro problema.",
            429,
          );
        if (error.code === "PGRST204" || error.code === "42703")
          throw new RequestError(
            "O novo fluxo ainda não foi habilitado no banco. Contate o administrador.",
            503,
          );
        throw new RequestError(
          "Não foi possível salvar o registro. Tente novamente.",
          503,
        );
      }
      return Response.json({ id: data.id }, { status: 201 });
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 400;
      return Response.json(
        {
          error:
            error instanceof RequestError
              ? error.message
              : "Confira os dados, a confirmação da análise e a autorização de publicação.",
        },
        { status },
      );
    }
  };
}

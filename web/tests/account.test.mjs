import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  normalizeWhatsapp,
  passwordProblem,
  authenticatorQr,
} from "../src/lib/account.ts";
import { profilePhotoHandler } from "../src/lib/server/profile-photo.ts";

test("WhatsApp normaliza DDI e rejeita números fora de E.164", () => {
  assert.equal(normalizeWhatsapp("(34) 99999-9999"), "+5534999999999");
  assert.equal(normalizeWhatsapp("+1 202 555 0123"), "+12025550123");
  assert.equal(normalizeWhatsapp(""), "");
  assert.throws(() => normalizeWhatsapp("123"));
  assert.throws(() => normalizeWhatsapp("+0123456789"));
});
test("senha exige comprimento e confirmação sem remover espaços", () => {
  assert.ok(passwordProblem("admin123", "admin123"));
  assert.ok(passwordProblem("uma senha longa", "outra senha longa"));
  assert.equal(passwordProblem("uma senha longa", "uma senha longa"), "");
});
test("QR suporta SVG bruto e data URL sem aceitar URL externa", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  assert.equal(decodeURIComponent(authenticatorQr(svg).split(",")[1]), svg);
  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  assert.equal(authenticatorQr(encoded), encoded);
  assert.throws(() => authenticatorQr("https://unknown.test/qr"));
});

function fakeDatabase({
  failSave = false,
  lostResponse = false,
  lostConfirmation = false,
} = {}) {
  const removed = [],
    uploaded = [];
  let current = "owner/old.jpg";
  return {
    removed,
    uploaded,
    auth: {
      getUser: async () => ({ data: { user: { id: "owner" } }, error: null }),
    },
    rpc: async (name, params) => {
      if (name === "viaalerta_set_avatar") {
        if (!failSave) current = params.p_path;
        return {
          data: null,
          error:
            failSave || lostResponse
              ? {
                  message: "database failure",
                  code: failSave ? "23514" : undefined,
                }
              : null,
        };
      }
      return name === "viaalerta_my_account_status"
        ? { data: { state: "active", until: null, reason: null }, error: null }
        : name === "viaalerta_my_preferences"
          ? {
              data: { avatar_path: current },
              error:
                lostConfirmation && uploaded.length
                  ? { message: "offline" }
                  : null,
            }
          : {
              data: null,
              error: failSave ? { message: "database failure" } : null,
            };
    },
    storage: {
      from: () => ({
        upload: async (path, bytes) => {
          uploaded.push({ path, bytes });
          return { error: null };
        },
        remove: async (paths) => {
          removed.push(...paths);
          return { error: null };
        },
      }),
    },
  };
}
function config() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
}
async function photoRequest(contents, type = "image/png") {
  const form = new FormData();
  form.set("file", new File([contents], "photo.png", { type }));
  return new Request("https://web.test/api/profile-photo", {
    method: "POST",
    headers: { authorization: "Bearer fake-user-token" },
    body: form,
  });
}
test("foto exige autenticação antes de consumir o corpo", async () => {
  let called = false;
  const r = await profilePhotoHandler(() => {
    called = true;
    throw Error();
  })(new Request("https://web.test", { method: "POST" }));
  assert.equal(r.status, 401);
  assert.equal(called, false);
});
test("foto é reprocessada para JPEG pequeno e a anterior é removida", async () => {
  config();
  const db = fakeDatabase();
  const png = await sharp({
    create: { width: 700, height: 500, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const r = await profilePhotoHandler(() => db)(await photoRequest(png));
  assert.equal(r.status, 200);
  assert.match(db.uploaded[0].path, /^owner\//);
  const meta = await sharp(db.uploaded[0].bytes).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 320);
  assert.equal(meta.height, 320);
  assert.equal(meta.exif, undefined);
  assert.deepEqual(db.removed, ["owner/old.jpg"]);
});
test("falha ao salvar o perfil remove o novo objeto e preserva o anterior", async () => {
  config();
  const db = fakeDatabase({ failSave: true });
  const png = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const r = await profilePhotoHandler(() => db)(await photoRequest(png));
  assert.equal(r.status, 503);
  assert.deepEqual(db.removed, [db.uploaded[0].path]);
});
test("arquivo falso não é enviado ao armazenamento", async () => {
  config();
  const db = fakeDatabase();
  const r = await profilePhotoHandler(() => db)(
    await photoRequest("not an image"),
  );
  assert.equal(r.status, 400);
  assert.equal(db.uploaded.length, 0);
});

test("avatar salvo com resposta perdida é confirmado sem apagar a foto ativa", async () => {
  config();
  const db = fakeDatabase({ lostResponse: true });
  const png = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const response = await profilePhotoHandler(() => db)(await photoRequest(png));
  assert.equal(response.status, 200);
  assert.deepEqual(db.removed, ["owner/old.jpg"]);
});

test("estado desconhecido após resposta perdida preserva as duas fotos", async () => {
  config();
  const db = fakeDatabase({ lostResponse: true, lostConfirmation: true });
  const png = await sharp({
    create: { width: 32, height: 32, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const response = await profilePhotoHandler(() => db)(await photoRequest(png));
  assert.equal(response.status, 503);
  assert.deepEqual(db.removed, []);
});

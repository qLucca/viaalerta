import { gpsFixture } from "./fixtures/photo.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  validateRegistration,
  distanceMeters,
  nearbyRecords,
  missingRegistration,
} from "../src/lib/registration.ts";
import {
  resizedDimensions,
  jpegGps,
  photoGps,
  validateSourcePhoto,
} from "../src/lib/photo.ts";
import { registrationHandler } from "../src/lib/server/registrations.ts";

const id = "11111111-1111-4111-8111-111111111111";
const actor = "22222222-2222-4222-8222-222222222222";
const payload = () => ({
  id,
  latitude: -18.882,
  longitude: -48.255,
  description: "Referência",
  problem_type: "buraco",
  immediate_danger: false,
  analysis_state: "failed",
  ai_feedback: "not_verified",
  human_has_pothole: true,
  consent: true,
  analysis: {
    image_width: 64,
    image_height: 48,
    detections: [],
    simulated: false,
  },
});

test("registro sem IA é permitido somente sem detecções e com autorização explícita", () => {
  assert.equal(
    validateRegistration(payload(), 64, 48).analysis_state,
    "failed",
  );
  assert.throws(() =>
    validateRegistration({ ...payload(), consent: false }, 64, 48),
  );
  assert.throws(() =>
    validateRegistration({ ...payload(), ai_feedback: "confirmed" }, 64, 48),
  );
  assert.throws(() =>
    validateRegistration({ ...payload(), latitude: 91 }, 64, 48),
  );
  assert.throws(() => validateRegistration(payload(), 65, 48));
});
test("feedback diferencia confirmação, correção de falso positivo e falso negativo", () => {
  const analysis = {
    image_width: 64,
    image_height: 48,
    simulated: false,
    detections: [
      {
        class_id: 0,
        class_name: "buraco",
        confidence: 0.6,
        bbox: [1, 2, 20, 30],
      },
    ],
  };
  const base = {
    ...payload(),
    analysis_state: "completed",
    analysis,
    ai_feedback: "confirmed",
  };
  assert.equal(validateRegistration(base, 64, 48).human_has_pothole, true);
  assert.throws(() =>
    validateRegistration({ ...base, human_has_pothole: false }, 64, 48),
  );
  assert.equal(
    validateRegistration(
      { ...base, human_has_pothole: false, ai_feedback: "corrected" },
      64,
      48,
    ).ai_feedback,
    "corrected",
  );
  assert.equal(
    validateRegistration(
      {
        ...base,
        analysis: { ...analysis, detections: [] },
        ai_feedback: "corrected",
      },
      64,
      48,
    ).ai_feedback,
    "corrected",
  );
  assert.throws(() =>
    validateRegistration({ ...base, human_has_pothole: null }, 64, 48),
  );
  assert.throws(() =>
    validateRegistration({ ...base, problem_type: "iluminacao" }, 64, 48),
  );
});
test("duplicatas usam raio de 30 m, ignoram encerrados e distinguem tipo de problema", () => {
  const point = [-18.882, -48.255],
    record = {
      id: "a",
      latitude: point[0],
      longitude: point[1],
      status: "pendente",
      problem_type: "buraco",
    };
  assert.equal(distanceMeters(point, point), 0);
  assert.ok(distanceMeters([0, 179.9999], [0, -179.9999]) < 30);
  const found = nearbyRecords(
    [
      record,
      { ...record, id: "closed", status: "resolvido" },
      { ...record, id: "rejected", status: "rejeitado" },
      { ...record, id: "far", latitude: point[0] + 0.00028 },
      { ...record, id: "other", problem_type: "iluminacao" },
    ],
    point,
    "buraco",
  );
  assert.deepEqual(
    found.map((r) => r.id),
    ["a"],
  );
});
test("preparo não aumenta fotos pequenas e limita o lado maior e o consumo de memória", () => {
  assert.deepEqual(resizedDimensions(4000, 3000), {
    width: 1600,
    height: 1200,
  });
  assert.deepEqual(resizedDimensions(3000, 4000), {
    width: 1200,
    height: 1600,
  });
  assert.deepEqual(resizedDimensions(640, 480), { width: 640, height: 480 });
  for (const size of [
    [0, 10],
    [NaN, 12],
    [10000, 10000],
  ])
    assert.throws(() => resizedDimensions(...size));
  assert.throws(
    () =>
      validateSourcePhoto(
        new File(["x"], "photo.heic", { type: "image/heic" }),
      ),
    /JPG/,
  );
  assert.throws(
    () =>
      validateSourcePhoto(new File([], "photo.jpg", { type: "image/jpeg" })),
    /vazia/,
  );
  assert.equal(
    jpegGps(new Uint8Array([255, 216, 255, 225, 255, 255]).buffer),
    undefined,
  );
});
test("envio exige foto, revisão humana, local confirmado, consulta de duplicatas e consentimento", () => {
  const complete = {
    photo: true,
    processing: false,
    reviewed: true,
    location: true,
    duplicatesResolved: true,
    consent: true,
  };
  assert.equal(missingRegistration(complete), "");
  for (const field of [
    "photo",
    "reviewed",
    "location",
    "duplicatesResolved",
    "consent",
  ])
    assert.ok(missingRegistration({ ...complete, [field]: false }));
  assert.ok(missingRegistration({ ...complete, processing: true }));
});

function fakeDatabase({
  validUser = true,
  insertError = null,
  uploadError = null,
  existing = null,
  lookupError = null,
} = {}) {
  const calls = { uploads: [], inserts: [], removes: [], lookups: 0 };
  const db = {
    auth: {
      getUser: async () => ({
        data: { user: validUser ? { id: actor } : null },
        error: null,
      }),
    },
    storage: {
      from: () => ({
        upload: async (path, bytes, options) => {
          calls.uploads.push({ path, bytes, options });
          return { error: uploadError };
        },
        remove: async (paths) => {
          calls.removes.push(paths);
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq() {
          return this;
        },
        maybeSingle: async () => {
          calls.lookups++;
          return { data: existing, error: lookupError };
        },
      }),
      insert: async (data) => {
        calls.inserts.push(data);
        return { error: insertError };
      },
    }),
  };
  return { db, calls };
}
async function request(file, data = payload(), authorized = true) {
  const form = new FormData();
  form.append("file", file);
  form.append("data", JSON.stringify(data));
  return new Request("https://example.test/api/registrations", {
    method: "POST",
    headers: authorized ? { Authorization: "Bearer fake-token" } : {},
    body: form,
  });
}
const photo = async () =>
  new File(
    [
      await sharp({
        create: { width: 64, height: 48, channels: 3, background: "#247d61" },
      })
        .jpeg()
        .withMetadata({ exif: { IFD0: { Artist: "METADADO_PRIVADO" } } })
        .toBuffer(),
    ],
    "foto.jpg",
    { type: "image/jpeg" },
  );
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test";

test("backend recusa sessão ausente/expirada, MIME falso e arquivo inválido antes de publicar", async () => {
  const { db, calls } = fakeDatabase();
  const handler = registrationHandler(() => db);
  assert.equal(
    (await handler(await request(await photo(), payload(), false))).status,
    401,
  );
  assert.equal(
    (
      await registrationHandler(() => fakeDatabase({ validUser: false }).db)(
        await request(await photo()),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await handler(
        await request(
          new File(["not an image"], "foto.jpg", { type: "image/jpeg" }),
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handler(
        await request(
          new File([await (await photo()).arrayBuffer()], "x.png", {
            type: "image/png",
          }),
        ),
      )
    ).status,
    400,
  );
  assert.equal(calls.uploads.length, 0);
});
test("backend redesenha a foto, remove EXIF e persiste feedback sem exigir a IA", async () => {
  const { db, calls } = fakeDatabase();
  const response = await registrationHandler(() => db)(
    await request(await photo()),
  );
  assert.equal(response.status, 201);
  assert.equal(calls.inserts[0].analysis_state, "failed");
  const metadata = await sharp(calls.uploads[0].bytes).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.width, 64);
  assert.equal(metadata.height, 48);
  assert.equal(calls.uploads[0].options.contentType, "image/jpeg");
  assert.equal(calls.inserts[0].user_id, actor);
});
test("backend limita corpo sem Content-Length e recusa envio sem autorização de publicação", async () => {
  const { db, calls } = fakeDatabase();
  const handler = registrationHandler(() => db);
  const body = new Uint8Array(8 * 1024 * 1024 + 65537);
  const bigRequest = new Request("https://example.test", {
    method: "POST",
    headers: {
      Authorization: "Bearer fake-token",
      "Content-Type": "multipart/form-data; boundary=x",
    },
    body,
  });
  assert.equal((await handler(bigRequest)).status, 413);
  const consentResponse = await handler(
    await request(await photo(), { ...payload(), consent: false }),
  );
  assert.equal(consentResponse.status, 400);
  assert.equal(calls.uploads.length, 0);
});
test("limite de registros é tratado como 429 e falha ao gravar remove somente foto órfã", async () => {
  const { db, calls } = fakeDatabase({ insertError: { code: "P0001" } });
  assert.equal(
    (await registrationHandler(() => db)(await request(await photo()))).status,
    429,
  );
  assert.equal(calls.removes.length, 1);
  const existing = fakeDatabase({ existing: { id } });
  assert.equal(
    (await registrationHandler(() => existing.db)(await request(await photo())))
      .status,
    200,
  );
  assert.equal(existing.calls.uploads.length, 0);
});

test("GPS do JPEG é lido como sugestão e metadados truncados ou inválidos são ignorados", () => {
  const point = jpegGps(gpsFixture());
  assert.ok(Math.abs(point[0] + 18.8819444444) < 1e-8);
  assert.equal(point[1], -48.255);
  assert.equal(jpegGps(gpsFixture().slice(0, 100)), undefined);
  const broken = gpsFixture();
  new DataView(broken).setUint32(12 + 80 + 4, 0, true);
  assert.equal(jpegGps(broken), undefined);
});

test("EXIF em PNG e WebP usa a mesma sugestão de GPS e ignora chunks inválidos", () => {
  const tiff = new Uint8Array(gpsFixture().slice(12, 140));
  const png = new Uint8Array(8 + 12 + tiff.length),
    p = new DataView(png.buffer);
  p.setUint32(0, 0x89504e47);
  p.setUint32(4, 0x0d0a1a0a);
  p.setUint32(8, tiff.length);
  p.setUint32(12, 0x65584966);
  png.set(tiff, 16);
  const webp = new Uint8Array(12 + 8 + tiff.length),
    w = new DataView(webp.buffer);
  w.setUint32(0, 0x52494646);
  w.setUint32(4, webp.length - 8, true);
  w.setUint32(8, 0x57454250);
  w.setUint32(12, 0x45584946);
  w.setUint32(16, tiff.length, true);
  webp.set(tiff, 20);
  assert.deepEqual(photoGps(png.buffer, "image/png"), jpegGps(gpsFixture()));
  assert.deepEqual(photoGps(webp.buffer, "image/webp"), jpegGps(gpsFixture()));
  assert.equal(photoGps(webp.buffer.slice(0, 25), "image/webp"), undefined);
});

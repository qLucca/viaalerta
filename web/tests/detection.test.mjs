import test from "node:test";
import assert from "node:assert/strict";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://teste.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_teste";
const { supabase } = await import("../src/lib/supabase/client.ts");
supabase.auth.getSession = async () => ({
  data: { session: { access_token: "token-ficticio-teste" } },
  error: null,
});
const { validateImage, analyzeImage } = await import(
  "../src/lib/api/detection.ts"
);
globalThis.Image = class {
  naturalWidth = 640;
  naturalHeight = 480;
  set src(_) {
    queueMicrotask(() => this.onload());
  }
};
const photo = () => new File(["sample"], "road.jpg", { type: "image/jpeg" });
test("rejeita tipo incorreto, arquivo vazio e tamanho acima de 8 MB", () => {
  assert.throws(
    () => validateImage(new File(["x"], "x.svg", { type: "image/svg+xml" })),
    /JPG/,
  );
  assert.throws(
    () => validateImage(new File([], "x.jpg", { type: "image/jpeg" })),
    /vazia/,
  );
  assert.throws(
    () =>
      validateImage(
        new File([new Uint8Array(8 * 1024 * 1024 + 1)], "x.jpg", {
          type: "image/jpeg",
        }),
      ),
    /8 MB/,
  );
});
test("mock explícito produz XYXY compatível com a imagem e identifica simulação", async () => {
  const result = await analyzeImage(photo(), true);
  assert.equal(result.simulated, true);
  assert.equal(result.image_width, 640);
  assert.equal(result.detections.length, 1);
  const [x1, y1, x2, y2] = result.detections[0].bbox;
  assert.ok(x2 > x1 && y2 > y1 && x2 <= 640 && y2 <= 480);
});
test("mock suporta imagem sem detecções", async () => {
  const result = await analyzeImage(photo(), true, true);
  assert.deepEqual(result.detections, []);
  assert.equal(result.simulated, true);
});
test("serviço envia multipart e aceita contrato válido sem marcar simulação", async () => {
  process.env.NEXT_PUBLIC_DETECTION_API_URL = "https://api.example.test/detect";
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, process.env.NEXT_PUBLIC_DETECTION_API_URL);
      assert.equal(options.method, "POST");
      assert.equal(
        options.headers.Authorization,
        "Bearer token-ficticio-teste",
      );
      assert.equal(options.body.get("file").name, "road.jpg");
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json({
        image_width: 640,
        image_height: 480,
        detections: [
          {
            class_id: 0,
            class_name: "buraco",
            confidence: 0.94,
            bbox: [120, 85, 280, 230],
          },
        ],
      });
    };
    assert.equal((await analyzeImage(photo(), false)).simulated, false);
  } finally {
    globalThis.fetch = original;
  }
});
test("análise real exige sessão antes de enviar a foto", async () => {
  process.env.NEXT_PUBLIC_DETECTION_API_URL = "https://api.example.test/detect";
  const original = supabase.auth.getSession;
  try {
    supabase.auth.getSession = async () => ({
      data: { session: null },
      error: null,
    });
    await assert.rejects(analyzeImage(photo(), false), /Entre na sua conta/);
  } finally {
    supabase.auth.getSession = original;
    delete process.env.NEXT_PUBLIC_DETECTION_API_URL;
  }
});
test("recusa endpoint HTTP remoto antes de transmitir sessão e fotografia", async () => {
  process.env.NEXT_PUBLIC_DETECTION_API_URL = "http://api.example.test/detect";
  const original = globalThis.fetch;
  let transmitted = false;
  try {
    globalThis.fetch = async () => {
      transmitted = true;
      throw new Error("Não deveria enviar");
    };
    await assert.rejects(analyzeImage(photo(), false), /HTTPS/);
    assert.equal(transmitted, false);
  } finally {
    globalThis.fetch = original;
    delete process.env.NEXT_PUBLIC_DETECTION_API_URL;
  }
});
test("rejeita caixas inválidas, dimensões divergentes e erro HTTP", async () => {
  process.env.NEXT_PUBLIC_DETECTION_API_URL = "https://api.example.test/detect";
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({
        image_width: 640,
        image_height: 480,
        detections: [
          {
            class_id: 0,
            class_name: "buraco",
            confidence: 0.9,
            bbox: [300, 85, 280, 230],
          },
        ],
      });
    await assert.rejects(analyzeImage(photo(), false), /coordenadas inválidas/);
    globalThis.fetch = async () =>
      Response.json({ image_width: 320, image_height: 240, detections: [] });
    await assert.rejects(analyzeImage(photo(), false), /dimensões/);
    globalThis.fetch = async () => new Response("", { status: 503 });
    await assert.rejects(analyzeImage(photo(), false), /HTTP 503/);
  } finally {
    globalThis.fetch = original;
    delete process.env.NEXT_PUBLIC_DETECTION_API_URL;
  }
});

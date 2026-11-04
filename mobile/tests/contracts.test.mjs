import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAnalysis,
  simulatedAnalysis,
  assertPhoto,
} from "../src/lib/detection-contract.ts";
import { handleMapMessage, mapPayload } from "../src/map/types.ts";
import { secureSession } from "../src/lib/secure-session.ts";
test("resposta real válida conserva XYXY e não é simulada", () => {
  const result = parseAnalysis(
    {
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
    },
    640,
    480,
  );
  assert.equal(result.simulated, false);
  assert.deepEqual(result.detections[0].bbox, [120, 85, 280, 230]);
});
test("rejeita dimensões divergentes, confiança inválida e caixas invertidas", () => {
  const response = {
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
  };
  assert.throws(() => parseAnalysis(response, 320, 240));
  assert.throws(() =>
    parseAnalysis(
      {
        ...response,
        detections: [{ ...response.detections[0], confidence: 1.1 }],
      },
      640,
      480,
    ),
  );
  assert.throws(() =>
    parseAnalysis(
      {
        ...response,
        detections: [{ ...response.detections[0], bbox: [300, 80, 280, 100] }],
      },
      640,
      480,
    ),
  );
});
test("mock marca simulação e permite zero detecções; upload tem limites", () => {
  assert.equal(simulatedAnalysis(640, 480).simulated, true);
  assert.equal(simulatedAnalysis(640, 480, true).detections.length, 0);
  assert.throws(() => assertPhoto(9 * 1024 * 1024, 640, 480));
  assert.throws(() => assertPhoto(100, 10000, 10000));
});
test("ponte do mapa rejeita coordenadas e marcadores não autorizados", () => {
  let calls = 0;
  const props = {
    picking: true,
    records: [{ id: "known" }],
    onPoint: () => calls++,
    onSelect: () => calls++,
  };
  handleMapMessage(
    { source: "viaalerta-map", type: "point", point: [91, 0] },
    props,
  );
  handleMapMessage(
    { source: "viaalerta-map", type: "select", id: "unknown" },
    props,
  );
  handleMapMessage(
    { source: "other", type: "point", point: [-23, -46] },
    props,
  );
  assert.equal(calls, 0);
  handleMapMessage(
    { source: "viaalerta-map", type: "point", point: [-23, -46] },
    props,
  );
  handleMapMessage(
    { source: "viaalerta-map", type: "select", id: "known" },
    props,
  );
  assert.equal(calls, 2);
});
test("payload do mapa não envia fotos ou identificação privada", () => {
  const p = mapPayload(
    {
      records: [
        {
          id: "id",
          latitude: 0,
          longitude: 0,
          status: "pendente",
          description: "Rua",
          image_url: "private",
          user_id: "private",
        },
      ],
    },
    false,
  );
  assert.deepEqual(Object.keys(p.records[0]).sort(), [
    "description",
    "id",
    "latitude",
    "longitude",
    "status",
  ]);
});
function fixture() {
  const values = new Map();
  const adapter = {
    getItemAsync: async (k) => values.get(k) ?? null,
    setItemAsync: async (k, v) => {
      values.set(k, v);
    },
    deleteItemAsync: async (k) => {
      values.delete(k);
    },
  };
  return { values, adapter };
}
test("sessão longa com Unicode é reconstituída e removida por completo", async () => {
  const { values, adapter } = fixture();
  const storage = secureSession(adapter);
  const value = JSON.stringify({
    access_token: "a".repeat(4000),
    name: "José 👋".repeat(80),
  });
  await storage.setItem("auth", value);
  assert.equal(await storage.getItem("auth"), value);
  assert.ok(
    [...values.values()].every(
      (v) => new TextEncoder().encode(v).length < 2048,
    ),
  );
  await storage.removeItem("auth");
  assert.equal(values.size, 0);
});
test("falha na gravação não corrompe a sessão anterior", async () => {
  const { adapter, values } = fixture();
  const storage = secureSession(adapter);
  await storage.setItem("auth", "sessao-anterior");
  const write = adapter.setItemAsync;
  let calls = 0;
  adapter.setItemAsync = async (k, v) => {
    if (++calls === 2) throw new Error("disco indisponível");
    return write(k, v);
  };
  await assert.rejects(storage.setItem("auth", "x".repeat(1200)), /disco/);
  assert.equal(await storage.getItem("auth"), "sessao-anterior");
  assert.equal(values.size, 2);
});
test("índice antigo corrompido não impede gravar e remover uma sessão nova", async () => {
  const { adapter, values } = fixture();
  const storage = secureSession(adapter);
  values.set("auth", "{invalid");
  assert.equal(await storage.getItem("auth"), null);
  await storage.setItem("auth", "nova-sessao");
  assert.equal(await storage.getItem("auth"), "nova-sessao");
  await storage.removeItem("auth");
  assert.equal(values.size, 0);
});
test("tamanho e dimensões não finitos são recusados", () => {
  assert.throws(() => assertPhoto(NaN, 640, 480));
  assert.throws(() => assertPhoto(100, Infinity, 480));
  assert.throws(() => assertPhoto(100, 640.5, 480));
});

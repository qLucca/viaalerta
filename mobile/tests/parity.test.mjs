import test from "node:test";
import assert from "node:assert/strict";
import * as native from "../src/lib/registration.ts";
import * as web from "../../web/src/lib/registration.ts";
import * as admin from "../src/lib/admin-rules.ts";
import * as webAdmin from "../../web/src/lib/admin.ts";
import { draftQueue } from "../src/lib/draft-queue.ts";
import { queueCsv, csvCell } from "../src/lib/csv.ts";
import { queueCsv as webCsv } from "../../web/src/lib/csv.ts";

test("registro e moderação mantêm regras equivalentes à web", () => {
  assert.deepEqual(native.problemTypes, web.problemTypes);
  assert.deepEqual(admin.accountLabels, webAdmin.accountLabels);
  assert.deepEqual(admin.reportReasons, webAdmin.reportReasons);
  for (const state of ["active", "suspended", "banned", "invalid"])
    for (const reason of ["", "Justificativa válida", "x".repeat(1001)])
      for (const date of ["", "2030-01-02T00:00:00Z", "2032-01-01T00:00:00Z"])
        assert.equal(
          admin.restrictionProblem(
            state,
            reason,
            date,
            Date.parse("2030-01-01"),
          ),
          webAdmin.restrictionProblem(
            state,
            reason,
            date,
            Date.parse("2030-01-01"),
          ),
        );
});
test("outros tipos não recebem análise de buraco e correção humana conserva as detecções", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    latitude: -18,
    longitude: -48,
    description: "Local confirmado",
    problem_type: "buraco",
    immediate_danger: false,
    analysis_state: "completed",
    ai_feedback: "corrected",
    human_has_pothole: false,
    consent: true,
    analysis: {
      image_width: 100,
      image_height: 100,
      detections: [
        {
          class_id: 0,
          class_name: "buraco",
          confidence: 0.8,
          bbox: [10, 10, 50, 50],
        },
      ],
    },
  };
  assert.equal(
    native.validateRegistration(base, 100, 100).analysis.detections.length,
    1,
  );
  assert.throws(() =>
    native.validateRegistration(
      { ...base, ai_feedback: "confirmed" },
      100,
      100,
    ),
  );
  assert.throws(() =>
    native.validateRegistration(
      { ...base, problem_type: "iluminacao" },
      100,
      100,
    ),
  );
  for (const problem_type of Object.keys(native.problemTypes)) {
    const payload = {
      ...base,
      problem_type,
      analysis_state: "not_requested",
      ai_feedback: "not_verified",
      human_has_pothole: null,
      analysis: { image_width: 100, image_height: 100, detections: [] },
    };
    assert.equal(
      native.validateRegistration(payload, 100, 100).problem_type,
      problem_type,
    );
  }
});
test("consulta de duplicidade exclui encerrados e respeita tipo e distância como a web", () => {
  const base = {
    id: "a",
    latitude: -18.9186,
    longitude: -48.2772,
    status: "pendente",
    problem_type: "buraco",
  };
  const records = [
    base,
    { ...base, id: "b", status: "resolvido" },
    { ...base, id: "c", problem_type: "bueiro" },
    { ...base, id: "d", latitude: -19 },
    { ...base, id: "e", hidden_at: "2026-01-01" },
    { ...base, id: "f", cancelled_at: "2026-01-01" },
  ];
  assert.deepEqual(
    native
      .nearbyRecords(records, [-18.9186, -48.2772], "buraco")
      .map((x) => x.id),
    ["a"],
  );
  assert.deepEqual(
    native.nearbyRecords(records, [-18.9186, -48.2772], "buraco"),
    web.nearbyRecords(records, [-18.9186, -48.2772], "buraco"),
  );
});
test("rascunho preserva tipo e risco e aceita rascunhos antigos", async () => {
  const saved = new Map();
  const q = draftQueue(
    {
      getItem: async (k) => saved.get(k) || null,
      setItem: async (k, v) => saved.set(k, v),
    },
    { copy: async () => "file:///copy.jpg", remove: async () => {} },
  );
  const owner = "owner",
    photo = {
      uri: "file:///photo.jpg",
      size: 100,
      width: 100,
      height: 100,
      mime: "image/jpeg",
      name: "photo.jpg",
    };
  await q.add(
    owner,
    "11111111-1111-4111-8111-111111111111",
    photo,
    [-18, -48],
    "Teste",
    { type: "bueiro", danger: true },
  );
  assert.equal((await q.list(owner))[0].problem_type, "bueiro");
  assert.equal((await q.list(owner))[0].immediate_danger, true);
  const [key, value] = [...saved][0];
  const old = JSON.parse(value);
  delete old[0].problem_type;
  delete old[0].immediate_danger;
  saved.set(key, JSON.stringify(old));
  assert.equal((await q.list(owner))[0].problem_type, "buraco");
  assert.equal((await q.list(owner))[0].immediate_danger, false);
});
test("CSV mantém paridade e neutraliza fórmulas sem perder coordenadas negativas", () => {
  const rows = [
    {
      id: "a",
      status: "pendente",
      problem_type: "buraco",
      immediate_danger: true,
      description: '=HYPERLINK("x")',
      latitude: -18.9,
      longitude: -48.2,
    },
  ];
  assert.equal(queueCsv(rows), webCsv(rows));
  assert.ok(csvCell(" =SUM(A1)").includes("'"));
  assert.equal(csvCell(-18.9), '"-18.9"');
});

import test from "node:test";
import assert from "node:assert/strict";
import { parseAnalysis as web } from "../src/lib/api/detection.ts";
import { parseAnalysis as mobile } from "../../mobile/src/lib/detection-contract.ts";

test("web e Android aceitam o mesmo contrato e recusam as mesmas caixas inválidas", () => {
  const detection = { class_id: 0, class_name: "buraco", confidence: 0.94, bbox: [120, 85, 280, 230] };
  const result = { image_width: 640, image_height: 480, detections: [detection] };
  for (const value of [result, { ...result, detections: [] }])
    assert.deepEqual(web(value, 640, 480), mobile(value, 640, 480));
  for (const value of [
    { ...result, image_width: 320 },
    ...[
      { confidence: 1.1 }, { class_id: -1 }, { bbox: [300, 85, 280, 230] },
      { bbox: [0, 0, 641, 480] }, { bbox: [0, -1, 10, 20] },
    ].map((change) => ({ ...result, detections: [{ ...detection, ...change }] })),
  ]) {
    assert.throws(() => web(value, 640, 480));
    assert.throws(() => mobile(value, 640, 480));
  }
});

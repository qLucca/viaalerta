import test from "node:test";
import assert from "node:assert/strict";
import { currentLocation } from "../src/lib/location.ts";
test("GPS explícito solicita posição nova de alta precisão e conserva a margem", async () => {
  let options;
  const result = await currentLocation({
    getCurrentPosition(ok, _fail, opts) {
      options = opts;
      ok({ coords: { latitude: -18.9186, longitude: -48.2772, accuracy: 8 } });
    },
  });
  assert.deepEqual(result, { point: [-18.9186, -48.2772], accuracy: 8 });
  assert.deepEqual(options, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
});
test("GPS rejeita coordenadas inválidas e informa falha sem inventar posição", async () => {
  await assert.rejects(
    currentLocation({
      getCurrentPosition(ok) {
        ok({ coords: { latitude: 91, longitude: 0, accuracy: 8 } });
      },
    }),
    /inválida/,
  );
  await assert.rejects(
    currentLocation({
      getCurrentPosition(_ok, fail) {
        fail();
      },
    }),
    /Escolha o ponto/,
  );
  const result = await currentLocation({
    getCurrentPosition(ok) {
      ok({ coords: { latitude: 0, longitude: 0, accuracy: -1 } });
    },
  });
  assert.equal(result.accuracy, undefined);
});

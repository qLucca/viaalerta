import test from "node:test";
import assert from "node:assert/strict";
import { plural, dateLabel } from "../src/lib/format.ts";
import { DEFAULT_CITY, validMapPoints, previouslyAllowedLocation } from "../src/lib/location.ts";

test("contagens tratam zero, singular e plural irregular em pt-BR", () => {
  assert.equal(plural(0, "registro"), "0 registros");
  assert.equal(plural(1, "registro"), "1 registro");
  assert.equal(plural(2, "registro"), "2 registros");
  assert.equal(plural(1, "contribuição", "contribuições"), "1 contribuição");
  assert.equal(plural(1000, "detecção", "detecções"), "1.000 detecções");
});

test("datas não dependem do fuso do servidor nem quebram com valor inválido", () => {
  assert.equal(dateLabel("2026-11-11T01:00:00Z"), "10 de nov. de 2026");
  assert.equal(dateLabel("inválida"), "Data indisponível");
});

test("cidade de referência é Uberlândia e o pino do piloto é válido", () => {
  assert.equal(DEFAULT_CITY.name, "Uberlândia, MG");
  assert.deepEqual(DEFAULT_CITY.center, [-18.9186, -48.2772]);
  assert.deepEqual(validMapPoints([
    { latitude: -18.882, longitude: -48.255 },
    { latitude: 0, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: NaN, longitude: 0 },
  ]), [[-18.882, -48.255], [0, 0]]);
});

test("configuração inválida da cidade usa referência segura", async () => {
  const names = ["NEXT_PUBLIC_DEFAULT_CITY_NAME", "NEXT_PUBLIC_DEFAULT_CITY_LATITUDE", "NEXT_PUBLIC_DEFAULT_CITY_LONGITUDE"];
  const old = names.map((name) => process.env[name]);
  try {
    process.env[names[0]] = "Cidade de teste";
    process.env[names[1]] = "91";
    process.env[names[2]] = "abc";
    const { DEFAULT_CITY: fallback } = await import("../src/lib/location.ts?invalid-config");
    assert.deepEqual(fallback, { name: "Cidade de teste", center: [-18.9186, -48.2772] });
    process.env[names[1]] = "0";
    process.env[names[2]] = "-40";
    const { DEFAULT_CITY: custom } = await import("../src/lib/location.ts?custom-config");
    assert.deepEqual(custom.center, [0, -40]);
  } finally {
    names.forEach((name, i) => old[i] === undefined ? delete process.env[name] : process.env[name] = old[i]);
  }
});

test("centralização automática nunca pede uma nova permissão de localização", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let requests = 0;
  try {
    for (const state of ["prompt", "denied"]) {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
        permissions: { query: async () => ({ state }) },
        geolocation: { getCurrentPosition: () => { requests++; } },
      } });
      assert.equal(await previouslyAllowedLocation(), undefined);
    }
    assert.equal(requests, 0);
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
      permissions: { query: async () => ({ state: "granted" }) },
      geolocation: { getCurrentPosition: (resolve) => {
        requests++;
        resolve({ coords: { latitude: -18.882, longitude: -48.255 } });
      } },
    } });
    assert.deepEqual(await previouslyAllowedLocation(), [-18.882, -48.255]);
    assert.equal(requests, 1);
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
});

test("falha ou indisponibilidade de geolocalização mantém a cidade de referência", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    for (const navigator of [
      {},
      { permissions: { query: async () => { throw new Error("indisponível"); } }, geolocation: {} },
      { permissions: { query: async () => ({ state: "granted" }) }, geolocation: { getCurrentPosition: (_, reject) => reject(new Error("timeout")) } },
    ]) {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: navigator });
      assert.equal(await previouslyAllowedLocation(), undefined);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  }
});

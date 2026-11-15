import test from "node:test";
import assert from "node:assert/strict";
import { draftQueue } from "../src/lib/draft-queue.ts";
import { mapPayload } from "../src/map/types.ts";
const owner = "11111111-1111-4111-8111-111111111111";
const id = (n) => `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
const photo = {
  uri: "file:///cache/photo.jpg",
  width: 100,
  height: 100,
  size: 1000,
  name: "photo.jpg",
  mime: "image/jpeg",
};
function fixture() {
  const state = new Map(),
    copies = [],
    removed = [];
  const storage = {
    async getItem(k) {
      return state.get(k) ?? null;
    },
    async setItem(k, v) {
      state.set(k, v);
    },
  };
  const files = {
    async copy(p, i, o) {
      copies.push(i);
      return `file:///documents/${o}/${i}.jpg`;
    },
    async remove(uri) {
      removed.push(uri);
    },
  };
  return {
    state,
    storage,
    files,
    copies,
    removed,
    queue: draftQueue(storage, files),
  };
}
test("fila isola contas e preserva identificador ao repetir o mesmo rascunho", async () => {
  const f = fixture();
  await f.queue.add(owner, id(1), photo, [-18, -48], "foto");
  await f.queue.add(owner, id(1), photo, [-19, -49], "alterada");
  assert.equal(f.copies.length, 1);
  assert.equal((await f.queue.list(owner))[0].description, "foto");
  assert.deepEqual(await f.queue.list("other"), []);
  await f.queue.remove("other", id(1));
  assert.equal((await f.queue.list(owner)).length, 1);
});
test("gravações simultâneas não perdem itens; limite não copia a foto excedente", async () => {
  const f = fixture();
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      f.queue.add(owner, id(i), photo, [-18, -48], ""),
    ),
  );
  assert.equal((await f.queue.list(owner)).length, 20);
  await assert.rejects(
    f.queue.add(owner, id(21), photo, [-18, -48], ""),
    /Limite/,
  );
  assert.equal(f.copies.length, 20);
});
test("falha de índice limpa nova cópia, preserva fila e permite tentar novamente", async () => {
  const f = fixture();
  f.storage.setItem = async () => {
    throw Error("full");
  };
  await assert.rejects(
    f.queue.add(owner, id(1), photo, [-18, -48], ""),
    /não foi guardado/,
  );
  assert.equal(f.removed.length, 1);
  assert.deepEqual(await f.queue.list(owner), []);
  f.storage.setItem = async (k, v) => {
    f.state.set(k, v);
  };
  await f.queue.add(owner, id(1), photo, [-18, -48], "");
  assert.equal((await f.queue.list(owner)).length, 1);
});
test("índice corrompido e proprietário divergente não são sobrescritos", async () => {
  const f = fixture(),
    key = `viaalerta-offline-v1:${owner}`;
  f.state.set(key, "broken");
  await assert.rejects(
    f.queue.add(owner, id(1), photo, [-18, -48], ""),
    /preservados/,
  );
  assert.equal(f.state.get(key), "broken");
  assert.equal(f.copies.length, 0);
  f.state.delete(key);
  await f.queue.add(owner, id(1), photo, [-18, -48], "");
  const rows = JSON.parse(f.state.get(key));
  rows[0].owner = "other";
  f.state.set(key, JSON.stringify(rows));
  await assert.rejects(f.queue.list(owner), /preservados/);
});
test("coordenadas inválidas são recusadas e exclusão com falha conserva os dados", async () => {
  const f = fixture();
  await assert.rejects(f.queue.add(owner, id(1), photo, [91, -48], ""));
  await f.queue.add(owner, id(1), photo, [-18, -48], "");
  f.storage.setItem = async () => {
    throw Error("fail");
  };
  await assert.rejects(f.queue.remove(owner, id(1)));
  assert.equal((await f.queue.list(owner)).length, 1);
  assert.equal(f.removed.length, 0);
});
test("fila limita 80 MiB por conta e não aceita caminhos no identificador", async () => {
  const f = fixture(),
    large = { ...photo, size: 8 * 1024 * 1024 };
  for (let i = 0; i < 10; i++)
    await f.queue.add(owner, id(i), large, [-18, -48], "");
  await assert.rejects(
    f.queue.add(owner, id(11), photo, [-18, -48], ""),
    /Limite/,
  );
  await assert.rejects(f.queue.add("../other", id(12), photo, [-18, -48], ""));
});
test("mapa só aceita margem de precisão finita dentro do limite", () => {
  assert.equal(mapPayload({ accuracy: 7 }, false).accuracy, 7);
  for (const accuracy of [-1, NaN, Infinity, 10001])
    assert.equal(mapPayload({ accuracy }, false).accuracy, undefined);
});

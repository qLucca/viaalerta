import test from "node:test";
import assert from "node:assert/strict";
import { persistOnce } from "../src/lib/submission.ts";

test("resposta perdida após insert não duplica nem remove a fotografia", async () => {
  let saved = false,
    writes = 0,
    uploads = 0;
  const store = {
    exists: async () => saved,
    upload: async () => {
      uploads++;
      return {};
    },
    insert: async () => {
      writes++;
      saved = true;
      throw Error("network");
    },
  };
  await persistOnce(store);
  await persistOnce(store);
  assert.equal(writes, 1);
  assert.equal(uploads, 1);
});

test("repetição aceita a foto já enviada e confirma o mesmo registro", async () => {
  let attempt = 0;
  const store = {
    exists: async () => false,
    upload: async () => ({ error: { statusCode: "409" } }),
    insert: async () => (++attempt === 1 ? { error: { code: "offline" } } : {}),
  };
  await assert.rejects(persistOnce(store), /confirmar/);
  await persistOnce(store);
  assert.equal(attempt, 2);
});

test("falha na consulta ou upload impede gravação às cegas", async () => {
  let writes = 0;
  await assert.rejects(
    persistOnce({
      exists: async () => {
        throw Error("offline");
      },
      upload: async () => {
        writes++;
        return {};
      },
      insert: async () => {
        writes++;
        return {};
      },
    }),
    /offline/,
  );
  await assert.rejects(
    persistOnce({
      exists: async () => false,
      upload: async () => ({ error: { statusCode: "403" } }),
      insert: async () => {
        writes++;
        return {};
      },
    }),
    /fotografia/,
  );
  assert.equal(writes, 0);
});

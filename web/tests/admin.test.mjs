import test from "node:test";
import assert from "node:assert/strict";
import { restrictionProblem } from "../src/lib/admin.ts";
import { accountAccess } from "../src/lib/account-access.ts";
import { profilePhotoHandler } from "../src/lib/server/profile-photo.ts";
import { registrationHandler } from "../src/lib/server/registrations.ts";
import { interventionHandler } from "../src/lib/server/intervention.ts";

test("restrição exige motivo e prazo futuro válido, inclusive na reativação", () => {
  const now = Date.parse("2026-11-15T12:00:00Z");
  assert.ok(restrictionProblem("banned", "", "", now));
  assert.ok(
    restrictionProblem(
      "suspended",
      "Motivo de teste",
      "2026-11-15T11:00:00Z",
      now,
    ),
  );
  assert.ok(
    restrictionProblem("suspended", "Motivo de teste", "2028-01-01", now),
  );
  assert.ok(restrictionProblem("active", "", "", now));
  assert.equal(
    restrictionProblem(
      "suspended",
      "Motivo de teste",
      "2026-12-01T12:00:00Z",
      now,
    ),
    "",
  );
  assert.equal(restrictionProblem("banned", "Motivo de teste", "", now), "");
});
test("situação da conta falha de forma fechada e tolera somente RPC ainda não instalado", async () => {
  assert.equal(
    (
      await accountAccess({
        rpc: async () => ({ data: null, error: { code: "PGRST202" } }),
      })
    ).state,
    "active",
  );
  assert.equal(
    (
      await accountAccess({
        rpc: async () => ({
          data: { state: "banned", until: null, reason: "teste" },
          error: null,
        }),
      })
    ).state,
    "banned",
  );
  for (const result of [
    { data: null, error: { code: "network" } },
    { data: {}, error: null },
    { data: { state: "unexpected" }, error: null },
  ])
    await assert.rejects(accountAccess({ rpc: async () => result }));
});
test("conta suspensa ou banida não envia registro, foto de perfil ou foto de conclusão", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake";
  for (const state of ["suspended", "banned"]) {
    const db = {
      auth: {
        getUser: async () => ({ data: { user: { id: "test" } }, error: null }),
      },
      rpc: async () => ({
        data: { state, until: null, reason: "Moderação" },
        error: null,
      }),
    };
    for (const handler of [
      registrationHandler,
      profilePhotoHandler,
      interventionHandler,
    ]) {
      const request = new Request("https://web.test/upload", {
        method: "POST",
        headers: { authorization: "Bearer fake" },
        body: "not parsed",
      });
      const response = await handler(() => db)(request);
      assert.equal(response.status, 403);
    }
  }
});

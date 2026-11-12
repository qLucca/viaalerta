import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  requiresMfa,
  canManage,
  workflowProblem,
} from "../src/lib/workflow.ts";
import { csvCell, queueCsv } from "../src/lib/csv.ts";
import {
  listOccurrences,
  countOccurrences,
} from "../src/lib/api/occurrences.ts";
import { nearbyRecords } from "../src/lib/registration.ts";
import { interventionHandler } from "../src/lib/server/intervention.ts";

test("perfis institucionais e MFA têm requisitos distintos", () => {
  for (const role of ["agent", "manager", "admin"])
    assert.equal(canManage(role), true);
  for (const role of ["cidadao", "prefeitura", "qualquer"])
    assert.equal(canManage(role), false);
  assert.equal(requiresMfa("admin"), true);
  assert.equal(requiresMfa("manager"), true);
  assert.equal(requiresMfa("agent"), false);
});
test("andamento exige comentário, transição válida, motivo e foto conforme o destino", () => {
  assert.equal(
    workflowProblem(
      "pendente",
      "em_analise",
      "Equipe iniciou análise",
      "",
      "",
      "",
      "",
    ),
    "",
  );
  assert.ok(
    workflowProblem(
      "pendente",
      "resolvido",
      "Serviço pronto",
      "",
      "photo.jpg",
      "",
      "",
    ),
  );
  assert.ok(
    workflowProblem(
      "em_analise",
      "resolvido",
      "Serviço pronto",
      "",
      "",
      "",
      "",
    ),
  );
  assert.ok(
    workflowProblem(
      "em_analise",
      "rejeitado",
      "Não identificado",
      "",
      "",
      "",
      "",
    ),
  );
  assert.equal(
    workflowProblem(
      "em_analise",
      "rejeitado",
      "Não identificado",
      "",
      "",
      "nao_identificado",
      "",
    ),
    "",
  );
  assert.ok(
    workflowProblem(
      "em_analise",
      "duplicado",
      "Duplicata confirmada",
      "",
      "",
      "",
      "not-a-uuid",
    ),
  );
  assert.ok(
    workflowProblem(
      "em_analise",
      "programado",
      "Equipe irá ao local",
      "",
      "",
      "",
      "",
    ),
  );
});
test("CSV neutraliza fórmulas e preserva aspas, novas linhas e números negativos", () => {
  assert.equal(csvCell('=IMPORTXML("x")'), '"\'=IMPORTXML(""x"")"');
  assert.equal(csvCell("  @SUM(A1)"), '"\'  @SUM(A1)"');
  assert.equal(csvCell(-18.882), '"-18.882"');
  const csv = queueCsv([
    {
      id: "abc",
      status: "pendente",
      problem_type: "buraco",
      description: 'linha 1\nlinha "2"',
      latitude: -18.882,
    },
  ]);
  assert.ok(csv.startsWith("\ufeff"));
  assert.ok(csv.includes("Reportado"));
  assert.ok(csv.includes("Buraco"));
  assert.ok(csv.includes('linha ""2""'));
});
test("filtros e indicadores pessoais não misturam exemplos, cancelados ou registros de outros", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = [
    {
      id: "mine",
      owner_id: "demo",
      status: "pendente",
      problem_type: "buraco",
      created_at: "2026-11-12T12:00:00Z",
      latitude: -18.882,
      longitude: -48.255,
    },
    {
      id: "example",
      status: "em_analise",
      problem_type: "iluminacao",
      created_at: "2026-11-12T12:00:00Z",
      latitude: -18.882,
      longitude: -48.255,
    },
    {
      id: "cancelled",
      owner_id: "demo",
      status: "pendente",
      cancelled_at: "2026-11-12T13:00:00Z",
      created_at: "2026-11-12T12:00:00Z",
      latitude: -18.882,
      longitude: -48.255,
    },
    {
      id: "old",
      status: "pendente",
      created_at: "2025-01-01T00:00:00Z",
      latitude: -18.882,
      longitude: -48.255,
    },
  ];
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => JSON.stringify(records) },
  });
  try {
    assert.deepEqual(
      (await listOccurrences(true, { mine: true })).map((r) => r.id).sort(),
      ["cancelled", "mine"],
    );
    assert.equal(await countOccurrences(true, { mine: true }), 1);
    assert.deepEqual(
      (await listOccurrences(true, { mine: true, publicOnly: true })).map(
        (r) => r.id,
      ),
      ["mine"],
    );
    assert.deepEqual(
      (
        await listOccurrences(true, {
          type: "iluminacao",
          since: "2026-11-01T00:00:00Z",
        })
      ).map((r) => r.id),
      ["example"],
    );
    assert.deepEqual(
      nearbyRecords(records, [-18.882, -48.255], "buraco")
        .map((r) => r.id)
        .sort(),
      ["mine", "old"],
    );
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});
test("foto posterior exige sessão e permissão de atuação antes de subir o arquivo", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-test";
  const bytes = await sharp({
    create: { width: 40, height: 30, channels: 3, background: "#247d61" },
  })
    .jpeg()
    .toBuffer();
  const build = (authorized = true) => {
    const form = new FormData();
    form.append("file", new File([bytes], "after.jpg", { type: "image/jpeg" }));
    form.append("id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    form.append("consent", "true");
    return new Request("https://example.test", {
      method: "POST",
      headers: authorized ? { Authorization: "Bearer fake-token" } : {},
      body: form,
    });
  };
  let uploads = 0;
  const db = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
    },
    rpc: async () => ({ data: { can_manage: false }, error: null }),
    storage: {
      from: () => ({
        upload: async () => {
          uploads++;
          return { error: null };
        },
      }),
    },
  };
  const handler = interventionHandler(() => db);
  assert.equal((await handler(build(false))).status, 401);
  assert.equal((await handler(build())).status, 403);
  assert.equal(uploads, 0);
  db.rpc = async () => ({ data: { can_manage: true }, error: null });
  assert.equal((await handler(build())).status, 200);
  assert.equal(uploads, 1);
});

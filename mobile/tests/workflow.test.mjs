import test from "node:test";
import assert from "node:assert/strict";
import * as mobile from "../src/lib/workflow.ts";
import * as web from "../../web/src/lib/workflow.ts";
test("web e Android exigem os mesmos perfis, transições e evidências", () => {
  assert.deepEqual(mobile.transitions, web.transitions);
  assert.deepEqual(mobile.roleLabels, web.roleLabels);
  for (const role of ["cidadao", "agent", "manager", "admin", "prefeitura"]) {
    assert.equal(mobile.canManage(role), web.canManage(role));
    assert.equal(mobile.requiresMfa(role), web.requiresMfa(role));
  }
  for (const status of ["programado", "rejeitado", "resolvido", "duplicado"]) {
    assert.ok(
      mobile.workflowProblem(
        "em_analise",
        status,
        "Comentário válido",
        "",
        "",
        "",
        "",
      ),
    );
  }
  assert.equal(
    mobile.workflowProblem(
      "em_analise",
      "resolvido",
      "Serviço concluído",
      "",
      "foto.jpg",
      "",
      "",
    ),
    "",
  );
});

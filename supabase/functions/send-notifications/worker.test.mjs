import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "./worker.ts";
const config = {
  secret: "test-cron-secret",
  apiKey: "fake-key",
  from: "ViaAlerta <alerts@example.test>",
  webUrl: "https://web.example.test",
};
const request = (secret = config.secret) =>
  new Request("https://worker.example.test", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
const job = {
  id: "notification-1",
  lock_token: "lock-1",
  email: "citizen@example.com",
  title: "Em análise",
  message: "Mensagem do processo",
  occurrence_id: "record-1",
  intervention_date: "2099-12-15",
};
test("não consome fila sem autenticação ou configuração de e-mail", async () => {
  let calls = 0;
  const db = {
    rpc: async () => {
      calls++;
      return { data: [], error: null };
    },
  };
  assert.equal((await createWorker(config, db)(request("wrong"))).status, 401);
  assert.equal(
    (await createWorker({ ...config, apiKey: "" }, db)(request())).status,
    503,
  );
  assert.equal(calls, 0);
});
test("destinatário vem da fila, envio tem idempotência e resultado só é confirmado após sucesso", async () => {
  const calls = [];
  const db = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: name === "viaalerta_claim_emails" ? [job] : true,
        error: null,
      };
    },
  };
  let captured;
  const send = async (url, init) => {
    captured = { url, init };
    return Response.json({ id: "provider-1" });
  };
  const response = await createWorker(config, db, send)(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).sent, 1);
  assert.equal(
    captured.init.headers["Idempotency-Key"],
    "viaalerta-notification-1",
  );
  const body = JSON.parse(captured.init.body);
  assert.deepEqual(body.to, ["citizen@example.com"]);
  assert.match(body.text, /15\/12\/2099/);
  const finished = calls.find((call) => call.name === "viaalerta_finish_email");
  assert.equal(finished.args.p_error, null);
  assert.equal(finished.args.p_lock_token, "lock-1");
});

test("não envia e-mail quando o usuário retirou a autorização", async () => {
  let sends = 0;
  const db = {
    rpc: async (name) => ({
      data:
        name === "viaalerta_claim_emails"
          ? [job]
          : name === "viaalerta_delivery_allowed"
            ? false
            : true,
      error: null,
    }),
  };
  const r = await createWorker(config, db, async () => {
    sends++;
    return Response.json({ id: "provider" });
  })(request());
  assert.equal(sends, 0);
  assert.equal((await r.json()).failed, 1);
});
test("falha do provedor é gravada para retentativa sem declarar envio concluído", async () => {
  let finished;
  const db = {
    rpc: async (name, args) => {
      if (args) finished = args;
      return {
        data: name === "viaalerta_claim_emails" ? [job] : true,
        error: null,
      };
    },
  };
  const response = await createWorker(
    config,
    db,
    async () => new Response("unavailable", { status: 503 }),
  )(request());
  assert.equal((await response.json()).failed, 1);
  assert.match(finished.p_error, /503/);
  assert.equal(finished.p_provider_id, null);
});
test("não envia destinatários de teste e não ignora falha ao confirmar a fila", async () => {
  let sends = 0;
  const db = {
    rpc: async (name) => ({
      data:
        name === "viaalerta_claim_emails"
          ? [{ ...job, email: "admin@viaalerta.test" }]
          : false,
      error: null,
    }),
  };
  const r = await createWorker(config, db, async () => {
    sends++;
    return Response.json({ id: "x" });
  })(request());
  assert.equal(sends, 0);
  assert.equal(r.status, 503);
});

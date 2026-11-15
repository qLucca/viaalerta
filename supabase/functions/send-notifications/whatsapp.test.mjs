import test from "node:test";
import assert from "node:assert/strict";
import { createWhatsappWorker } from "./whatsapp.ts";
const config = {
  secret: "test-secret",
  token: "fake-token",
  phoneId: "123456",
  version: "v27.0",
  template: "viaalerta_atualizacao",
  language: "pt_BR",
  webUrl: "https://web.example.test",
};
const request = () =>
  new Request("https://worker.test?channel=whatsapp", {
    method: "POST",
    headers: { authorization: `Bearer ${config.secret}` },
  });
const job = {
  id: "notice",
  lock_token: "lock",
  whatsapp: "+5534999999999",
  title: "Registro em análise",
  occurrence_id: "record",
};
function database(allowed = true) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data:
          name === "viaalerta_claim_whatsapp"
            ? [job]
            : name === "viaalerta_delivery_allowed"
              ? allowed
              : true,
        error: null,
      };
    },
  };
}
test("sem provedor ou autenticação, fila não é consumida", async () => {
  const db = database();
  assert.equal(
    (await createWhatsappWorker({ ...config, token: "" }, db)(request()))
      .status,
    503,
  );
  assert.equal(
    (
      await createWhatsappWorker(
        config,
        db,
      )(new Request("https://worker.test", { method: "POST" }))
    ).status,
    401,
  );
  assert.equal(db.calls.length, 0);
});
test("envia template aprovado somente ao número autorizado vindo da fila", async () => {
  const db = database();
  let captured;
  const r = await createWhatsappWorker(config, db, async (url, init) => {
    captured = { url, body: JSON.parse(init.body) };
    return Response.json({ messages: [{ id: "wamid.test" }] });
  })(request());
  assert.equal((await r.json()).accepted, 1);
  assert.equal(
    captured.url,
    "https://graph.facebook.com/v27.0/123456/messages",
  );
  assert.equal(captured.body.to, "5534999999999");
  assert.equal(captured.body.template.name, config.template);
  assert.equal(
    captured.body.template.components[0].parameters[1].text,
    "https://web.example.test/ocorrencias/record",
  );
  assert.equal(db.calls.at(-1).args.p_provider_id, "wamid.test");
});
test("retirada de consentimento impede envio", async () => {
  const db = database(false);
  let sends = 0;
  await createWhatsappWorker(config, db, async () => {
    sends++;
    throw Error();
  })(request());
  assert.equal(sends, 0);
  assert.match(db.calls.at(-1).args.p_error, /cancelled/);
});
test("resposta desconhecida não é tratada como sucesso nem reenviada automaticamente", async () => {
  const db = database();
  const r = await createWhatsappWorker(config, db, async () => {
    throw Error("timeout");
  })(request());
  assert.equal((await r.json()).failed, 1);
  assert.match(db.calls.at(-1).args.p_error, /^uncertain:/);
});
test("erro ao confirmar fila é reportado, mesmo com aceite do provedor", async () => {
  const db = database();
  const rpc = db.rpc;
  db.rpc = async (name, args) =>
    name === "viaalerta_finish_whatsapp"
      ? { data: false, error: null }
      : rpc(name, args);
  const r = await createWhatsappWorker(config, db, async () =>
    Response.json({ messages: [{ id: "wamid.test" }] }),
  )(request());
  assert.equal(r.status, 503);
});

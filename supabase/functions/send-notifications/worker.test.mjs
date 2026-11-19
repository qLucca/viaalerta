import test from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "./worker.ts";
import { updateEmail } from "./email-template.ts";
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
  assert.match(body.html, /Acompanhar ocorrência/);
  assert.match(body.html, /Alterar preferências de e-mail/);
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

test("mensagem em HTML escapa conteúdo, fixa a origem dos links e limpa o assunto", () => {
  const result = updateEmail(
    {
      ...job,
      title: "Atualização\r\nBcc: falso",
      message: '<img src=x onerror="alert(1)"> & detalhes',
      occurrence_id: "id?next=https://outro.test",
    },
    "https://web.example.test/caminho?teste=1",
  );
  assert.doesNotMatch(result.subject, /[\r\n]/);
  assert.doesNotMatch(result.html, /<img/);
  assert.match(result.html, /&lt;img/);
  assert.match(
    result.html,
    /https:\/\/web\.example\.test\/ocorrencias\/id%3Fnext%3Dhttps%3A%2F%2Foutro\.test/,
  );
  assert.match(result.text, /https:\/\/web\.example\.test\/perfil/);
  assert.throws(() => updateEmail(job, "http://web.example.test"), /HTTPS/);
});

test("data ausente não inventa prazo e o texto simples permanece disponível", () => {
  const result = updateEmail(
    { ...job, intervention_date: null },
    config.webUrl,
  );
  assert.doesNotMatch(result.text, /Previsão de intervenção/);
  assert.doesNotMatch(result.html, /Previsão de intervenção/);
  assert.match(result.text, /Mensagem do processo/);
  assert.match(result.text, /Não é um canal oficial/);
});

test("lote respeita intervalo entre envios e conserva uma chave por notificação", async () => {
  const pauses = [],
    keys = [];
  const db = {
    rpc: async (name) => ({
      data:
        name === "viaalerta_claim_emails"
          ? [job, { ...job, id: "notification-2" }]
          : true,
      error: null,
    }),
  };
  const response = await createWorker(
    config,
    db,
    async (_url, init) => {
      keys.push(init.headers["Idempotency-Key"]);
      return Response.json({ id: "sent-" + keys.length });
    },
    async (ms) => {
      pauses.push(ms);
    },
  )(request());
  assert.deepEqual(pauses, [600]);
  assert.deepEqual(keys, [
    "viaalerta-notification-1",
    "viaalerta-notification-2",
  ]);
  assert.equal((await response.json()).sent, 2);
});

test("não consome a fila antes da atualização de segurança do banco", async () => {
  const calls = [];
  const db = {
    rpc: async (name) => {
      calls.push(name);
      return { data: false, error: null };
    },
  };
  const result = await createWorker(config, db)(request());
  assert.equal(result.status, 503);
  assert.deepEqual(calls, ["viaalerta_email_worker_ready"]);
});

test("Brevo usa remetente verificado e identifica o aceite sem expor a chave", async () => {
  const id = "11111111-1111-4111-8111-111111111111",
    calls = [];
  let payload;
  const db = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: name === "viaalerta_claim_emails" ? [{ ...job, id }] : true,
        error: null,
      };
    },
  };
  const result = await createWorker(
    { ...config, provider: "brevo", from: "ViaAlerta <sender@gmail.com>" },
    db,
    async (url, init) => {
      payload = { url, init, body: JSON.parse(init.body) };
      return Response.json({ messageId: "<brevo-message>" }, { status: 201 });
    },
  )(request());
  assert.equal((await result.json()).sent, 1);
  assert.equal(payload.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(payload.init.headers["api-key"], config.apiKey);
  assert.equal(payload.init.headers.Authorization, undefined);
  assert.deepEqual(payload.body.sender, {
    email: "sender@gmail.com",
    name: "ViaAlerta",
  });
  assert.deepEqual(payload.body.to, [{ email: job.email }]);
  assert.equal(payload.body.headers.idempotencyKey, id);
  assert.match(payload.body.htmlContent, /Acompanhar ocorrência/);
  assert.equal(
    calls.find((c) => c.name === "viaalerta_finish_email").args.p_provider_id,
    "<brevo-message>",
  );
});

test("limite gratuito adia o lote restante sem continuar chamando o provedor", async () => {
  const finishes = [];
  let sends = 0;
  const db = {
    rpc: async (name, args) => {
      if (name === "viaalerta_finish_email") finishes.push(args);
      return {
        data:
          name === "viaalerta_claim_emails"
            ? [job, { ...job, id: "notification-2" }]
            : true,
        error: null,
      };
    },
  };
  const result = await createWorker(
    config,
    db,
    async () => {
      sends++;
      return Response.json({ name: "daily_quota_exceeded" }, { status: 429 });
    },
    async () => {},
  )(request());
  const summary = await result.json();
  assert.equal(summary.deferred, 2);
  assert.equal(summary.sent, 0);
  assert.equal(sends, 1);
  assert.ok(finishes.every((f) => f.p_error.startsWith("deferred:quota:")));
});

test("timeout e aceite sem ID exigem revisão; não são declarados como envio concluído", async () => {
  for (const send of [
    async () => {
      throw Error("timeout");
    },
    async () => Response.json({}),
  ]) {
    let finish;
    const db = {
      rpc: async (name, args) => {
        if (name === "viaalerta_finish_email") finish = args;
        return {
          data: name === "viaalerta_claim_emails" ? [job] : true,
          error: null,
        };
      },
    };
    const result = await createWorker(config, db, send)(request());
    assert.equal((await result.json()).failed, 1);
    assert.match(finish.p_error, /^uncertain:/);
    assert.equal(finish.p_provider_id, null);
  }
});

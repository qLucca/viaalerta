import test from "node:test";
import assert from "node:assert/strict";
import * as mobile from "../src/lib/account.ts";
import * as web from "../../web/src/lib/account.ts";

test("senhas e contatos têm as mesmas regras na web e no Android", () => {
  for (const input of ["", "(34) 99999-9999", "+1 202 555 0123"])
    assert.equal(mobile.normalizeWhatsapp(input), web.normalizeWhatsapp(input));
  for (const input of ["123", "+0123456789"])
    assert.throws(() => mobile.normalizeWhatsapp(input));
  for (const [password, confirm] of [
    ["short", "short"],
    ["senha longa de teste", "senha longa de teste"],
    ["x".repeat(129), "x".repeat(129)],
    ["uma senha longa", "outra senha longa"],
  ])
    assert.equal(
      mobile.passwordProblem(password, confirm),
      web.passwordProblem(password, confirm),
    );
});

test("QR do autenticador aceita SVG local e rejeita um serviço externo", () => {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
  assert.equal(mobile.authenticatorSvg(svg), svg);
  assert.equal(
    mobile.authenticatorSvg(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    ),
    svg,
  );
  assert.equal(
    mobile.authenticatorSvg(`data:image/svg+xml;base64,${btoa(svg)}`),
    svg,
  );
  assert.throws(() => mobile.authenticatorSvg("https://external.example/qr"));
  assert.throws(() => mobile.authenticatorSvg("data:image/svg+xml,not-svg"));
});

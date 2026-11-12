import test from "node:test";
import assert from "node:assert/strict";
import { resizeForPhoto, selectWithFallback } from "../src/lib/photo-selection.ts";
test("foto de 50 megapixels é redimensionada antes do limite de saída", () => {
 assert.deepEqual(resizeForPhoto(8160, 6120), { width: 2000 });
 assert.deepEqual(resizeForPhoto(6120, 8160), { height: 2000 });
 assert.equal(resizeForPhoto(1200, 900), null);
 assert.throws(() => resizeForPhoto(0, 0), /dimensões/);
 assert.throws(() => resizeForPhoto(Infinity, 100), /dimensões/);
});
test("galeria Android tenta seletor compatível apenas após falha, não após cancelar", async () => {
 const calls=[]; const selected=await selectWithFallback(async legacy => { calls.push(legacy); if (!legacy) throw Error("picker unsupported"); return { canceled:false }; }, true);
 assert.equal(selected.canceled,false); assert.deepEqual(calls,[false,true]);
 const canceled=[]; await selectWithFallback(async legacy => { canceled.push(legacy); return { canceled:true }; },true);
 assert.deepEqual(canceled,[false]);
 await assert.rejects(() => selectWithFallback(async()=>{throw Error("permission")},false),/permission/);
});

import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://teste.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_teste";
const { supabase } = await import("../src/lib/supabase/client.ts");
const { listOccurrences, countOccurrences } = await import("../src/lib/api/occurrences.ts");

test("lista busca somente a página solicitada e limita o mapa a 500 pontos", async () => {
  const original = supabase.from;
  const ranges = [];
  const query = {
    select: () => query,
    order: () => query,
    range: async (start, end) => {
      ranges.push([start, end]);
      return { data: [{ id: "known", image_path: "photo.jpg" }], error: null };
    },
  };
  try {
    supabase.from = () => query;
    const page = await listOccurrences(false, { offset: 50, limit: 51 });
    assert.equal(page.length, 1);
    await listOccurrences(false, { limit: 10000 });
    assert.deepEqual(ranges, [[50, 100], [0, 499]]);
  } finally { supabase.from = original; }
});

test("contagem exata não baixa registros nem fotografias", async () => {
  const original = supabase.from;
  let selection;
  try {
    supabase.from = () => ({
      select: (columns, options) => {
        selection = { columns, options };
        return Promise.resolve({ count: 1234, error: null });
      },
    });
    assert.equal(await countOccurrences(false), 1234);
    assert.deepEqual(selection, { columns: "id", options: { count: "exact", head: true } });
  } finally { supabase.from = original; }
});

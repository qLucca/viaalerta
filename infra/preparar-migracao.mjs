import { readFile, writeFile } from "node:fs/promises";
const from = Number(
  process.argv.find((v) => v.startsWith("--from="))?.slice(7),
);
if (![1, 2, 3, 4, 5, 6, 7].includes(from))
  throw new Error(
    "Informe --from=1 até --from=7, indicando a primeira migração ainda não instalada. O esquema base deve existir.",
  );
const files = [
  "202611110001_municipal_workflow.sql",
  "202611110002_registration_flow.sql",
  "202611120003_priority_security.sql",
  "202611150004_account_communications.sql",
  "202611150005_admin_moderation.sql",
  "202611150006_channel_consent.sql",
  "202611160007_email_delivery_safety.sql",
].slice(from - 1);
const parts = [];
for (const file of files) {
  const sql = await readFile(
    new URL("../supabase/migrations/" + file, import.meta.url),
    "utf8",
  );
  parts.push(sql.replace(/^begin;\s*$/gim, "").replace(/^commit;\s*$/gim, ""));
}
const destination = new URL(
  "../supabase/implantacao.local.sql",
  import.meta.url,
);
await writeFile(
  destination,
  "begin;\n" + parts.join("\n") + "\ncommit;\n",
  "utf8",
);
console.log(
  "Pacote SQL gerado em supabase/implantacao.local.sql, fora do Git. Revise e teste antes de aplicar. Nenhuma conexão ao banco foi realizada.",
);

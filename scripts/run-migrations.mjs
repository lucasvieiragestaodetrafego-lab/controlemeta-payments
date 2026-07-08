import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL não definido. Preencha .env.local ou exporte a variável antes de rodar.");
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`Aplicando ${file}...`);
    await client.query(sql);
  }
  console.log("Migrations aplicadas com sucesso.");
  await client.end();
}

main().catch(async (err) => {
  console.error("Erro ao aplicar migrations:", err.message);
  await client.end();
  process.exit(1);
});

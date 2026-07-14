import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

let dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL não definido. Preencha .env.local ou exporte a variável antes de rodar.");
  process.exit(1);
}

// Remove aspas envolvendo o valor, caso tenham sido exportadas junto (ex: ao
// copiar direto de um .env.local que usa SUPABASE_DB_URL="postgres://...").
if (
  (dbUrl.startsWith('"') && dbUrl.endsWith('"')) ||
  (dbUrl.startsWith("'") && dbUrl.endsWith("'"))
) {
  dbUrl = dbUrl.slice(1, -1);
}

// Corrige connection strings com caracteres reservados (ex: "@") não
// codificados na senha, que quebram o parsing padrão de URL. Só codifica
// quando a string ainda não é uma URL válida — senão re-codificaria uma
// senha que já veio percent-encoded do .env.local (ex: "%40" virando "%2540").
function sanitizeConnectionString(url) {
  try {
    new URL(url);
    return url;
  } catch {
    // segue para tentar corrigir abaixo
  }

  const match = url.match(/^(postgres(?:ql)?:\/\/)(.+)@([^@/]+\/.*)$/);
  if (!match) return url;
  const [, scheme, credentials, hostAndRest] = match;
  const [user, ...passwordParts] = credentials.split(":");
  const password = passwordParts.join(":");
  const encodedPassword = encodeURIComponent(password);
  return `${scheme}${user}:${encodedPassword}@${hostAndRest}`;
}

dbUrl = sanitizeConnectionString(dbUrl);

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();
  await client.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await client.query("select filename from schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Pulando ${file} (já aplicada).`);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    console.log(`Aplicando ${file}...`);
    await client.query(sql);
    await client.query("insert into schema_migrations (filename) values ($1)", [file]);
  }
  console.log("Migrations aplicadas com sucesso.");
  await client.end();
}

main().catch(async (err) => {
  console.error("Erro ao aplicar migrations:", err.message);
  await client.end();
  process.exit(1);
});

/**
 * Creates the application database if it does not exist (connects via the default `postgres` DB).
 * Requires DATABASE_URL in .env (same as Prisma).
 */
import { Client } from "pg";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function parsePgConnection(connectionString: string): { dbName: string; adminUrl: string } {
  const proto = connectionString.startsWith("postgres:") ? "postgres:" : "postgresql:";
  const normalized = connectionString.replace(/^postgres(ql)?:/, "http:");
  const u = new URL(normalized);
  const dbName = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!dbName) {
    throw new Error("DATABASE_URL must include a database name (e.g. .../cashmir_biotech)");
  }
  const admin = new URL(normalized);
  admin.pathname = "/postgres";
  const adminUrl = admin.toString().replace(/^http:/, proto);
  return { dbName, adminUrl };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }

  const { dbName, adminUrl } = parsePgConnection(databaseUrl);
  const client = new Client({ connectionString: adminUrl });

  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (exists.rowCount) {
      console.log(`Database "${dbName}" already exists.`);
      return;
    }
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}".`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

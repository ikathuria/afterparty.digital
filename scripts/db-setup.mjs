// Apply db/schema.sql to the Neon database in DATABASE_URL.
//   node --env-file=.env.local scripts/db-setup.mjs
// Idempotent: schema uses "create table if not exists" / "create index if not exists".

import { readFileSync } from "node:fs";
import { db } from "../src/lib/db.ts";

const sql = db();
const schema = readFileSync("db/schema.sql", "utf8");

// Split into statements, stripping line comments. (No semicolons appear inside
// our statements, so a naive split is safe here.)
const statements = schema
  .split(";")
  .map((s) => s.replace(/--.*$/gm, "").trim())
  .filter(Boolean);

for (const stmt of statements) {
  await sql.query(stmt);
}
console.log(`✓ applied ${statements.length} statements to the database`);

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Neon serverless SQL client (HTTP). Lazily created so importing this module
 * never throws when DATABASE_URL is unset (e.g. during build).
 *
 * Usage:
 *   const sql = db();
 *   const rows = await sql`select * from events where slug = ${slug}`;
 *   await sql.query("insert into ... values ($1,$2)", [a, b]);
 */
export function db(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

/** Format a JS array as a Postgres array literal: ["a","b"] -> {"a","b"} */
export function toPgArray(arr: readonly string[]): string {
  return (
    "{" +
    arr
      .map((s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"')
      .join(",") +
    "}"
  );
}

type Cast = "jsonb" | "text[]" | "uuid[]";

/**
 * Chunked multi-row INSERT via a single parameterized query per chunk.
 * `rows` are objects keyed by column name. `casts` controls per-column
 * serialization (jsonb objects are JSON-stringified; array columns are
 * formatted as Postgres array literals).
 */
export async function insertRows(
  table: string,
  columns: string[],
  rows: Record<string, unknown>[],
  casts: Partial<Record<string, Cast>> = {},
  chunkSize = 500,
): Promise<void> {
  if (rows.length === 0) return;
  const sql = db();
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuesSql = chunk
      .map(
        (_, r) =>
          "(" +
          columns
            .map((c, ci) => {
              const ph = "$" + (r * columns.length + ci + 1);
              return casts[c] ? `${ph}::${casts[c]}` : ph;
            })
            .join(", ") +
          ")",
      )
      .join(", ");
    const params = chunk.flatMap((row) =>
      columns.map((c) => {
        const v = row[c];
        const cast = casts[c];
        if (cast === "jsonb") return JSON.stringify(v ?? {});
        if (cast === "text[]" || cast === "uuid[]") return toPgArray((v as string[]) ?? []);
        return v ?? null;
      }),
    );
    await sql.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${valuesSql}`,
      params,
    );
  }
}

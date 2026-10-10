import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getDb as getWebDb } from "../../web/src/db/index";
import * as schema from "../../web/src/db/schema";

let pool: pg.Pool | null = null;

export function getWorkerDb() {
  if (process.env.VITEST === "true") {
    return getWebDb();
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!pool) pool = new pg.Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

export { schema };

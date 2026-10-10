import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import type { Db } from "./types";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!pool) {
    pool = new pg.Pool({ connectionString: url });
  }
  return pool;
}

export function getDb(): Db {
  if (process.env.VITEST === "true") {
    const { getTestDb } = require("./test-db") as typeof import("./test-db");
    return getTestDb();
  }
  return drizzle(getPool(), { schema });
}

export type { Db } from "./types";

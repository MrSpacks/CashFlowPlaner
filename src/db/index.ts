import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Один пул на процесс (в dev переживает hot-reload).
const g = globalThis as unknown as { __cfpPool?: Pool };
const pool = g.__cfpPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
g.__cfpPool = pool;

export const db = drizzle(pool, { schema });

export function getDb() {
  return db;
}

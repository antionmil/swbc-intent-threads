import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Missing DATABASE_URL is NOT fatal at import time. A build day starts by
 *  writing UI, often before Neon is provisioned - a hard throw here would
 *  block that. Callers that need the db get a clear error instead. */
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function db() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Provision Neon, or use the in-memory paths.");
  _db = drizzle(neon(url), { schema });
  return _db;
}

export const hasDb = () => Boolean(process.env.DATABASE_URL);
export { schema };

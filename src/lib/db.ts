import "server-only";
import { neon } from "@neondatabase/serverless";

/**
 * One database per site. Never point a new build at an existing project —
 * day 1 of this run executed another product's schema into a live database by
 * accident and the tables collided.
 *
 * The connection string arrives under whichever name the host happened to set:
 * Vercel's Neon integration sets DATABASE_URL_UNPOOLED and POSTGRES_URL, and
 * day 2 lost an hour to code that read only DATABASE_URL.
 */
const NAMES = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

export function connectionString(): string | null {
  for (const n of NAMES) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return null;
}

export const hasDb = () => connectionString() !== null;

let client: ReturnType<typeof neon> | null = null;
export function sql() {
  const cs = connectionString();
  if (!cs) throw new Error("no connection string configured");
  if (!client) client = neon(cs);
  return client;
}

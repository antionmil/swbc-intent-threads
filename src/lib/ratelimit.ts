import { sql } from "drizzle-orm";
import { db, hasDb, schema } from "./db";

const IP_LIMIT = Number(process.env.IP_DAILY_LIMIT ?? 3);
const CEILING = Number(process.env.DAILY_GENERATION_CEILING ?? 2000);

const memo = new Map<string, number>();
const today = () => new Date().toISOString().slice(0, 10);

export async function ipHash(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + today()));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

async function bump(bucket: string): Promise<number> {
  const day = today();
  if (!hasDb()) {
    const n = (memo.get(bucket) ?? 0) + 1;
    memo.set(bucket, n);
    return n;
  }
  // One atomic statement. Two statements would race under concurrency and
  // under-count exactly when the ceiling matters most.
  const rows = await db()
    .insert(schema.events)
    .values({ bucket, day, n: 1 })
    .onConflictDoUpdate({
      target: schema.events.bucket,
      set: { n: sql`${schema.events.n} + 1` },
    })
    .returning({ n: schema.events.n });
  return rows[0]?.n ?? 1;
}

export type Gate =
  | { ok: true }
  | { ok: false; reason: "ip"; limit: number }
  | { ok: false; reason: "ceiling" };

/**
 * Call BEFORE any generation. Two layers:
 *  - per IP per day, so one person cannot drain the budget
 *  - a global daily ceiling, so a front-page day cannot become a surprise bill
 *
 * Past the ceiling the site serves cache only. Build that state now - you will
 * not have time to design it on a viral day.
 */
export async function checkGate(req: Request): Promise<Gate> {
  const day = today();
  const total = await bump(`gen:${day}`);
  if (total > CEILING) return { ok: false, reason: "ceiling" };
  const h = await ipHash(req);
  const mine = await bump(`gen:${day}:${h}`);
  if (mine > IP_LIMIT) return { ok: false, reason: "ip", limit: IP_LIMIT };
  return { ok: true };
}

/** Honeypot plus a minimum time-on-form. Cheap, no captcha, no third party. */
export function looksLikeBot(form: { trap?: string; startedAt?: number }) {
  if (form.trap) return true;
  if (form.startedAt && Date.now() - form.startedAt < 2000) return true;
  return false;
}

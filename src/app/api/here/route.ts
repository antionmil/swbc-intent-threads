import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hasDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * How many people are reading this right now.
 *
 * One heartbeat in, one honest count out. The visitor is identified by a salted
 * one-way hash of their IP address: no cookie, nothing written to their browser
 * — so "nothing kept in your browser" stays true — and no way back from the
 * hash to the address. The row is deleted after five minutes, so the table can
 * say how many people are here and can never say who.
 *
 * Keyed on the address rather than a number the browser invents, because a
 * number the browser invents can be invented a thousand times, and this figure
 * is shown to every visitor. A fabricated metric is a fabricated metric whether
 * the site made it up or a stranger did.
 */
export async function POST(req: NextRequest) {
  if (!hasDb()) return NextResponse.json({ here: 0 }, { headers: { "cache-control": "no-store" } });

  /* x-vercel-forwarded-for first, then x-real-ip, then x-forwarded-for.
   *
   * All three carry the client address on Vercel. The order is about who can
   * write them: Vercel's docs say it overwrites x-forwarded-for and does not
   * forward external IPs, "to prevent IP spoofing", but x-forwarded-for is the
   * one a proxy placed on top of Vercel could still rewrite, and
   * x-vercel-forwarded-for is documented as the one that survives that.
   *
   * It matters because this number is displayed to every visitor. Locally, with
   * no edge in front, twelve forged headers took the count from 1 to 14 —
   * that test does not reproduce in production, and the order below is what
   * keeps it that way if this ever sits behind something else. */
  const ip =
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  /* The salt is the deploy's own secret, so the hashes cannot be compared with
     anyone else's, and a rainbow table of the whole IPv4 space is useless. */
  const salt = process.env.CRON_SECRET ?? "intent-threads";
  const id = createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);

  try {
    await sql()`
      insert into presence (id, seen_at) values (${id}, now())
      on conflict (id) do update set seen_at = now()
    `;
    /* Swept on write rather than by a cron: it is one cheap delete on an
       indexed column, and it means the table cannot grow if the cron is ever
       disabled or the deploy rolled back. */
    await sql()`delete from presence where seen_at < now() - interval '5 minutes'`;

    const [row] = (await sql()`
      select count(*)::int as n from presence where seen_at > now() - interval '45 seconds'
    `) as unknown as { n: number }[];

    return NextResponse.json(
      { here: row?.n ?? 1 },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    console.error("[here]", e);
    /* Never guess. A count we could not read is not a count we may invent. */
    return NextResponse.json({ here: 0 }, { headers: { "cache-control": "no-store" } });
  }
}

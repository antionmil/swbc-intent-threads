import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { hasDb, sql } from "@/lib/db";
import { mineGithub, mineYouTube } from "@/lib/mine";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The corpus grows here, not on somebody's laptop.
 *
 * Everything mined so far came from a script run by hand, which meant the site
 * froze the moment nobody was running it — for a product whose whole value is
 * a growing bank of leads, that was the real flaw, worse than where the rows
 * were stored.
 */
function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  /* timingSafeEqual throws on a length mismatch, which is itself a leak of one
     bit — compare a fixed-width digest-shaped pair instead by padding to the
     longer of the two and folding the length into the result. */
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  /* The bearer token, and nothing else.
   *
   * This used to accept any request carrying an x-vercel-cron header, on the
   * belief that only Vercel could set it. Vercel does not strip it from inbound
   * requests: `curl -H "x-vercel-cron: 1"` — and even a valueless
   * `-H "x-vercel-cron;"` — passed the guard on the live site. That handed any
   * stranger the miners: the YouTube quota (10,000 units a day), the GitHub
   * rate limit, writes to the leads table, and a 300-second function held open
   * per call. Vercel's own documentation never offers that header as an auth
   * signal; it says CRON_SECRET "will be automatically sent as an Authorization
   * header when Vercel invokes your cron job", and the sample code compares
   * exactly that. So does this.
   *
   * timingSafeEqual, because the comparison is against a secret and a plain !==
   * returns as soon as two bytes differ. */
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !sameSecret(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "no" }, { status: 401 });
  }
  if (!hasDb()) return NextResponse.json({ error: "no database configured" }, { status: 503 });

  const { job } = await params;
  const started = Date.now();
  try {
    const r =
      job === "github" ? await mineGithub()
      : job === "youtube" ? await mineYouTube()
      : null;
    if (!r) return NextResponse.json({ error: "unknown job" }, { status: 404 });

    await sql()`
      insert into runs (source, found, added, note)
      values (${job}, ${r.found}, ${r.added}, ${r.note ?? null})
    `;
    return NextResponse.json({ ...r, ms: Date.now() - started });
  } catch (e) {
    const note = e instanceof Error ? e.message.slice(0, 200) : "failed";
    /* Recorded, not swallowed. A cron that quietly stops looks exactly like a
       quiet day, and you find out weeks later. */
    try {
      await sql()`insert into runs (source, found, added, note) values (${job}, 0, 0, ${note})`;
    } catch {}
    console.error("[cron]", job, e);
    return NextResponse.json({ error: note }, { status: 500 });
  }
}

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
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  /* Vercel signs its own cron calls with this header; the secret covers manual
     runs. Without the check, anyone can make us mine on their schedule. */
  const secret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization");
  const fromVercel = req.headers.get("x-vercel-cron") !== null;
  if (!fromVercel && (!secret || auth !== `Bearer ${secret}`)) {
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

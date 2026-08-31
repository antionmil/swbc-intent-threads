import { NextResponse } from "next/server";
import { db, hasDb, schema } from "@/lib/db";
import { ipHash, looksLikeBot } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Unauthenticated submission path. Four ideas need this (09, 10, 22, and the
 *  public feeds on 04a/06); none of them needs accounts. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON." }, { status: 400 });
  }

  const kind = typeof body.kind === "string" ? body.kind : null;
  if (!kind) return NextResponse.json({ error: "Missing kind." }, { status: 400 });

  // Honeypot + minimum time-on-form. Silently accept so bots do not learn.
  if (looksLikeBot({ trap: body.trap as string, startedAt: body.startedAt as number })) {
    return NextResponse.json({ ok: true, id: null });
  }

  if (!hasDb()) return NextResponse.json({ error: "No database configured." }, { status: 503 });

  const payload = (body.payload ?? {}) as Record<string, unknown>;
  const rows = await db().insert(schema.submissions)
    .values({ kind, payload, ip_hash: await ipHash(req) })
    .returning({ id: schema.submissions.id });

  return NextResponse.json({ ok: true, id: rows[0]?.id ?? null });
}

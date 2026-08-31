import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";
import { SponsorSlot } from "@/components/SponsorSlot";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!hasDb()) return null;
  const rows = await db().select().from(schema.results).where(eq(schema.results.id, id)).limit(1);
  return rows[0] ?? null;
}

/** This is what makes results shareable with NO auth anywhere in the system:
 *  a stored row, a short url, and correct meta tags. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r) return { title: "Not found" };
  const q = new URLSearchParams({ title: r.title });
  if (r.stat) q.set("stat", r.stat);
  if (r.subtitle) q.set("subtitle", r.subtitle);
  const og = `/api/og?${q.toString()}`;
  return {
    title: r.title,
    description: r.subtitle ?? undefined,
    openGraph: { title: r.title, description: r.subtitle ?? undefined, images: [og] },
    twitter: { card: "summary_large_image", title: r.title, images: [og] },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await load(id);
  if (!r || !r.public) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-16">
      <header className="flex flex-col gap-3">
        {r.stat ? <div className="font-display text-6xl font-bold text-accent">{r.stat}</div> : null}
        <h1 className="font-display text-3xl font-bold tracking-tight">{r.title}</h1>
        {r.subtitle ? <p className="text-lg text-muted">{r.subtitle}</p> : null}
      </header>

      <pre className="overflow-x-auto rounded-lg border border-rule bg-surface p-4 text-sm">
        {JSON.stringify(r.payload, null, 2)}
      </pre>

      <SponsorSlot />
    </main>
  );
}

import { SponsorSlot } from "@/components/SponsorSlot";

/** Replace wholesale on build day. Kept here so a fresh clone renders
 *  something honest and you can see the tokens working. */
export default function Home() {
  const name = process.env.NEXT_PUBLIC_SITE_NAME ?? "SWBC scaffold";
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-5 py-20">
      <header className="flex flex-col gap-3">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          September build challenge
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">{name}</h1>
        <p className="max-w-prose text-lg text-muted">
          Three hours, hard stop. If it is not done at three hours it ships unfinished.
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-rule bg-surface p-6">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted">
          Wired and ready
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
          <li><code>getOrCompute</code> - cache layer, Postgres-backed</li>
          <li><code>complete()</code> / <code>batchSubmit()</code> - model calls, hash-cached</li>
          <li><code>checkGate()</code> - per-IP limit and the global daily ceiling</li>
          <li><code>/api/og</code> - share images, fonts already solved</li>
          <li><code>/r/[id]</code> - shareable results, no auth anywhere</li>
          <li><code>/api/submit</code> - unauthenticated submissions with a honeypot</li>
          <li><code>/api/cron/[job]</code> - secret-gated, writes static artifacts</li>
        </ul>
      </section>

      <SponsorSlot />
    </main>
  );
}

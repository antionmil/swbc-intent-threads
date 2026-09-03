import type { Metadata } from "next";
import Link from "next/link";
import { recent, total } from "@/lib/leads";
import { Face } from "@/components/Face";

export const revalidate = 3600;

/* Where the person said it. The takedown link that used to sit on every row is
   gone: it invited a stranger to click "remove me" next to somebody else's name,
   and the page-level notice on the front page says the same thing once. */
const WHERE: Record<string, (l: { repo: string; ctx?: string }) => string> = {
  github: (l) => l.repo || "GitHub",
  youtube: (l) => (l.ctx ? `YouTube · ${l.ctx}` : "YouTube"),
  hn: () => "Hacker News",
};

export const metadata: Metadata = {
  /* Belt and braces with robots.txt: a disallow asks a crawler not to fetch the
     page, while noindex keeps it out of the results even if something links
     straight to it. Real people's names are on this page. */
  robots: { index: false, follow: true },
  title: "The bank — Intent threads",
  description: "Every public ask in the index: one person, what they wanted, and where they said it.",
};

/* The whole corpus, newest first, best-scoring first within a day. Static: the
   same page for everybody, so it has no business being computed per request. */
/* Reads the database, like the front page does. It used to read the bundled
   artifact and so announced 1,905 asks while the home page said 1,931 — two
   different numbers for the same thing, on the same site. Still static: this is
   the same page for everybody, revalidated hourly. */
export default async function Bank() {
  const [rows, count] = await Promise.all([recent(250), total()]);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-10 pb-20 sm:px-6">
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/" className="text-muted underline underline-offset-4 hover:text-accent">
          ← Find yours
        </Link>
        {/* The removal route reaches every page a person could land on, not just
            the home page — somebody sent a link to their own row arrives here. */}
        <Link href="/privacy" className="text-muted underline underline-offset-4 hover:text-accent">
          What this site holds, and how to come out of it
        </Link>
      </p>

      <header className="mt-7">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">The bank</h1>
        <p className="prose-tight mt-4 max-w-prose text-lg leading-relaxed text-body">
          {count.toLocaleString()} times somebody said in public that they wanted
          something. Newest first. If one of them describes a thing you could build, the
          person who wants it is one click away.
        </p>
        <p className="prose-tight mt-3 max-w-prose text-sm text-muted">
          Showing the {Math.min(250, rows.length).toLocaleString()} most recent. Paste a product on the
          front page to see only the ones that match it.
        </p>
      </header>

      <ol className="mt-9">
        {rows.map((l) => (
          <li key={l.id} className="flex items-start gap-3 border-b border-rule py-5">
            <span className="mt-0.5">
              <Face who={l.who} src={l.src} avatar={l.avatar} size={30} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="prose-tight leading-relaxed break-words text-body">{l.wish}</p>
              {l.ctx && (
                <p className="mt-1.5 text-xs text-faint">
                  asked under <span className="text-muted">{l.ctx}</span>
                </p>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-muted">
                <span>{l.who}</span>
                <span aria-hidden>·</span>
                {/* Three sources, not two. This read `github ? repo : "Hacker News"`
                    and so labelled every YouTube comment as Hacker News — a wrong
                    attribution under a real person's real name. */}
                <span>{WHERE[l.src]?.(l) ?? l.src}</span>
                <span aria-hidden>·</span>
                <span>{l.when}</span>
                <span aria-hidden>·</span>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener nofollow"
                  aria-label={`Reply to ${l.who} on ${WHERE[l.src]?.(l) ?? l.src}`}
                  className="text-accent underline underline-offset-4"
                >
                  reply ↗
                </a>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

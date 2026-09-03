import type { Metadata } from "next";
import Link from "next/link";
import { LEADS } from "@/lib/corpus";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "The bank — Intent threads",
  description: "Every public ask in the index: one person, what they wanted, and where they said it.",
};

/* The whole corpus, newest first, best-scoring first within a day. Static: the
   same page for everybody, so it has no business being computed per request. */
export default function Bank() {
  const rows = [...LEADS]
    .sort((a, b) => (b.when ?? "").localeCompare(a.when ?? "") || b.score - a.score)
    .slice(0, 250);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-10 pb-20 sm:px-6">
      <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-accent">
        ← Find yours
      </Link>

      <header className="mt-7">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">The bank</h1>
        <p className="prose-tight mt-4 max-w-prose text-lg leading-relaxed text-body">
          {LEADS.length.toLocaleString()} times somebody said in public that they wanted
          something. Newest first. If one of them describes a thing you could build, the
          person who wants it is one click away.
        </p>
        <p className="prose-tight mt-3 max-w-prose text-sm text-muted">
          Showing the {Math.min(250, LEADS.length)} most recent. Paste a product on the
          front page to see only the ones that match it.
        </p>
      </header>

      <ol className="mt-9">
        {rows.map((l) => (
          <li key={l.id} className="border-b border-rule py-5">
            <p className="prose-tight leading-relaxed text-body">{l.wish}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-xs text-muted">
              <span>{l.who}</span>
              <span aria-hidden>·</span>
              <span>{l.src === "github" ? l.repo || "GitHub" : "Hacker News"}</span>
              <span aria-hidden>·</span>
              <span>{l.when}</span>
              <span aria-hidden>·</span>
              <a
                href={l.url}
                target="_blank"
                rel="noopener nofollow"
                className="text-accent underline underline-offset-4"
              >
                reply ↗
              </a>
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}

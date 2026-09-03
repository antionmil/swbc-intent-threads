import Link from "next/link";
import { LEADS } from "@/lib/corpus";

export const revalidate = 3600;

/**
 * The front door is one field.
 *
 * Deliberately reads NO searchParams: doing so makes the route `ƒ`, and a page
 * that is server-rendered on every request is the thing the build table exists
 * to catch. A failed lookup renders its own message on /find instead of
 * bouncing back here with a query string.
 */
export default function Home() {
  const total = LEADS.length;
  const fresh = LEADS.filter((l) => (l.when ?? "") >= isoDaysAgo(7)).length;
  const newest = LEADS.reduce((a, l) => (l.when > a ? l.when : a), "");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-5 pt-16 pb-20 sm:px-6 sm:pt-24">
      <p className="text-[11px] tracking-[0.24em] text-faint uppercase">Intent threads</p>

      <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
        People already asked for what you built.
      </h1>
      <p className="prose-tight mt-5 max-w-prose text-lg leading-relaxed text-body">
        Paste your product. We read what it says it does, then find the strangers who
        publicly asked for it — and exactly where to go and say hello.
      </p>

      <form action="/find" className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input
          name="url"
          type="text"
          inputMode="url"
          required
          autoFocus
          placeholder="yourproduct.com"
          aria-label="Your product's web address"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-surface px-4 py-3.5 font-mono text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <button className="rounded-xl bg-accent px-7 py-3.5 text-sm font-medium tracking-[0.04em] text-ground">
          Find them
        </button>
      </form>

      <p className="mt-5 text-xs text-faint">
        {total.toLocaleString()} public asks indexed · {fresh} from the last 7 days ·
        newest {newest}
      </p>
      <p className="mt-2 text-xs text-faint">
        No sign-up and no account. We do not store the address you paste — it is read
        once, matched, and gone. Page views are counted by Vercel Analytics, which sets
        no cookie.
      </p>

      <section className="mt-16 border-t border-rule pt-10">
        <h2 className="text-sm tracking-[0.12em] text-muted uppercase">What is in here</h2>
        <p className="prose-tight mt-3 max-w-prose text-body">
          Every row is one person, in public, saying they wanted something that did not
          exist for them yet — pulled from Hacker News comments and GitHub issues. Their
          words, their link, their name. Nothing is inferred and nothing is scraped from
          anywhere private.
        </p>
        <p className="prose-tight mt-3 max-w-prose text-sm text-muted">
          Reddit is not in here: its public API returns 403 unauthenticated and the free
          tier is non-commercial. 4chan is not either — 1% of posters have a name, so
          there is nobody to write to.
        </p>
        <p className="prose-tight mt-3 max-w-prose text-sm text-muted">
          If one of these is you and you would rather not be here, say so and it
          comes out — every ask under that name, on the next rebuild, no questions.{" "}
          <a
            href="https://github.com/antionmil/swbc-intent-threads/issues/new?title=Please+remove+me&body=Your+handle+or+the+link+to+your+comment%3A"
            target="_blank"
            rel="noopener nofollow"
            className="underline underline-offset-4 hover:text-accent"
          >
            Ask us to remove you
          </a>
          .
        </p>
        <p className="mt-6">
          <Link href="/bank" className="text-sm text-accent underline underline-offset-4">
            Browse the whole bank instead →
          </Link>
        </p>
      </section>
    </main>
  );
}

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

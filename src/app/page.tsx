import Link from "next/link";
import { freshCount, lastFind, recent, total } from "@/lib/leads";
import { Here } from "@/components/Here";
import { Feed } from "@/components/Feed";
import { Paste, StickyPaste } from "@/components/Paste";

export const revalidate = 900;

/**
 * The wire.
 *
 * The proof comes before the pitch: real people, real words, real links are on
 * screen before anybody is asked to type anything. A field on an empty page
 * asks a stranger to trust a claim; a page already running asks them to check
 * one. The input sits over the top of the stream, and follows down as a bar.
 *
 * Reads NO searchParams — doing so makes the route `ƒ`, and a page that is
 * server-rendered on every request is exactly what the build table exists to
 * catch. A failed lookup renders its own message on /find.
 */
export default async function Home() {
  /* All three from the same place. This page used to print a live database
     total beside a freshness figure counted off the build-time artifact. */
  const [count, fresh, rows, run] = await Promise.all([total(), freshCount(), recent(14), lastFind()]);

  return (
    <main className="relative">
      {/* The glow is decorative and sits behind everything, so it is aria-hidden
          and pointer-events-none — otherwise it eats clicks on the field. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          background:
            "radial-gradient(80% 100% at 50% 0%, rgba(127,179,213,0.13), rgba(127,179,213,0) 70%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-2xl px-5 pt-14 pb-20 sm:px-6 sm:pt-20">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-[11px] tracking-[0.24em] text-faint uppercase">Intent threads</p>
          <Here found={run.found} when={run.when} />
        </div>

        <h1 className="mt-5 text-4xl leading-[1.06] font-semibold tracking-tight text-balance sm:text-[3.25rem]">
          People already asked for what you built.
        </h1>
        <p className="prose-tight mt-5 max-w-prose text-lg leading-relaxed text-body">
          Paste your product. We read what it says it does, then find the strangers who
          publicly asked for it — and exactly where to go and say hello.
        </p>

        <div className="mt-7">
          <Paste big />
        </div>
        <StickyPaste />

        <p className="mt-4 text-xs text-faint">
          {count.toLocaleString()} public asks indexed · {fresh} of them from the last 7
          days · no sign-up, nothing kept in your browser
        </p>

        {/* The wire itself. Nothing separates it from the field but a label — the
            rows are the argument, so they start above the fold. */}
        <div className="mt-12 flex items-baseline justify-between border-b border-rule pb-2.5">
          <h2 className="text-[11px] tracking-[0.2em] text-muted uppercase">
            Live · newest first
          </h2>
          <Link href="/bank" className="text-xs text-accent hover:underline">
            the whole bank →
          </Link>
        </div>

        {/* The server's clock, so the relative dates are identical in the cached HTML
            and after hydration. */}
        <Feed initial={rows} now={new Date().toISOString()} />

        <p className="mt-6 text-center">
          <Link href="/bank" className="text-sm text-accent underline underline-offset-4">
            Keep reading — the whole bank →
          </Link>
        </p>

        <section className="mt-20 border-t border-rule pt-10">
          <h2 className="text-sm tracking-[0.12em] text-muted uppercase">What is in here</h2>
          <p className="prose-tight mt-3 max-w-prose text-body">
            Every row is one person, in public, saying they wanted something that did not
            exist for them yet — from Hacker News comments, GitHub issues and YouTube
            comments. Their words, their name, their link. Nothing is inferred and nothing
            comes from anywhere private.
          </p>
          <p className="prose-tight mt-3 max-w-prose text-sm text-muted">
            The photographs are the ones those accounts show publicly on those sites.
            Hacker News publishes none, so those rows get initials instead of a face.
          </p>
          <p className="prose-tight mt-3 max-w-prose text-sm text-muted">
            Reddit is not in here: its public API returns 403 unauthenticated and the free
            tier is non-commercial. 4chan is not either — 1% of posters have a name, so
            there is nobody to write to.
          </p>
          <p className="prose-tight mt-3 max-w-prose text-sm text-muted">
            If one of these is you and you would rather not be here, say so and it comes
            out — every ask under that name, on the next rebuild, no questions.{" "}
            <a
              href="https://github.com/antionmil/swbc-intent-threads/issues/new?title=Please+remove+me&body=Your+handle+or+the+link+to+your+comment%3A"
              target="_blank"
              rel="noopener nofollow"
              className="underline underline-offset-4 hover:text-accent"
            >
              Ask us to remove you
            </a>
            , or read{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-accent">
              what this site holds
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}


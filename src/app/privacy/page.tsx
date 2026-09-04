import type { Metadata } from "next";
import Link from "next/link";
import { total } from "@/lib/leads";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "What this site holds — Intent threads",
  description:
    "What Intent threads stores, where it came from, and how to have yourself taken out of it.",
};

const REMOVE =
  "https://github.com/antionmil/swbc-intent-threads/issues/new?title=Please+remove+me&body=Your+handle+or+the+link+to+your+comment%3A";

/* Named people, quoted words, a photograph and a link to go and contact them —
 * that combination needs a page saying so plainly, in words the person it is
 * about can read. Nothing here is a term of art. */
export default async function Privacy() {
  const count = await total();
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-10 pb-20 sm:px-6">
      <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-accent">
        ← Back
      </Link>

      <h1 className="mt-7 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
        What this site holds
      </h1>

      <section className="mt-8">
        <h2 className="text-sm tracking-[0.14em] text-muted uppercase">If you pasted a URL</h2>
        <p className="prose-tight mt-3 leading-relaxed text-body">
          The page at that address is fetched once, from our server, and read for its title,
          its description and its first few headings. Those words are turned into a list of
          terms and matched against the index. The result is cached for an hour so that the
          same address does not cause a second fetch, and then it is gone. The address is not
          stored in a database, not attached to you, and not sold or shared. There is no
          account, no cookie and no tracking pixel.
        </p>
        <p className="prose-tight mt-3 leading-relaxed text-muted">
          The front page says how many people are reading it. That count comes from a
          one-way hash of your IP address, salted with a secret only this deployment
          knows, held for five minutes and then deleted. It cannot be turned back into
          an address, it is not a cookie, and nothing is written to your browser. It
          exists so the number is real: identifying a reader by something the browser
          makes up would let one person claim to be a hundred.
        </p>
        <p className="prose-tight mt-3 leading-relaxed text-muted">
          Page views are counted by Vercel Analytics, which records the path and coarse
          country, and does not use cookies or build a profile of you. Our host keeps ordinary
          server logs, as every web host does.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm tracking-[0.14em] text-muted uppercase">If you are in the index</h2>
        <p className="prose-tight mt-3 leading-relaxed text-body">
          There are {count.toLocaleString()} entries. Each one is a message somebody published
          in public — a GitHub issue, a Hacker News comment, a YouTube comment — in which they
          said they wanted something that did not exist for them. For each we hold: the words
          themselves, the account name they were posted under, the link back to the original,
          the date, the repository or video it was posted under, and the address of the profile
          picture that account shows publicly on that platform. The picture is loaded from the
          platform, not copied here.
        </p>
        <p className="prose-tight mt-3 leading-relaxed text-body">
          Nothing private is collected. There is no email address, no location, no attempt to
          work out who anybody is beyond the name they chose to post under. Nothing is inferred
          and nothing is bought.
        </p>
        <p className="prose-tight mt-3 leading-relaxed text-muted">
          Why we think this is allowed: the material is already public, and the purpose — helping
          somebody find a person who asked for the thing they built — is a legitimate interest
          under Article 6(1)(f) GDPR. That interest does not outweigh your objection. If you
          object, you come out. No reason needed and nothing to justify.
        </p>
      </section>

      <section className="mt-10 rounded-xl border border-edge p-5">
        <h2 className="text-sm tracking-[0.14em] text-muted uppercase">Taking yourself out</h2>
        <p className="prose-tight mt-3 leading-relaxed text-body">
          Open an issue and give the handle or a link to the message. Every entry under that
          name is removed, from the live index immediately and from the published data file on
          the next rebuild. You do not have to prove the account is yours; a wrong removal costs
          this site one row, and the alternative asks you to hand over more about yourself than
          the entry contains.
        </p>
        <p className="mt-4">
          <a
            href={REMOVE}
            target="_blank"
            rel="noopener nofollow"
            className="inline-block rounded-full border border-edge px-4 py-2 text-sm text-body transition-colors hover:border-accent hover:text-accent"
          >
            Ask to be removed ↗
          </a>
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm tracking-[0.14em] text-muted uppercase">Not affiliated</h2>
        <p className="prose-tight mt-3 leading-relaxed text-muted">
          This site is not connected to, endorsed by, or operated with GitHub, Y Combinator,
          Hacker News, Google or YouTube. Each entry links back to the original so you can read
          it in the place it was written. It is one of 26 sites built in 26 days at{" "}
          <a
            href="https://onedaybuilt.com"
            className="underline underline-offset-4 hover:text-accent"
          >
            onedaybuilt.com
          </a>
          .
        </p>
      </section>
    </main>
  );
}

import Link from "next/link";
import { LeadRow } from "@/components/LeadRow";
import { band, rank, type Hit } from "@/lib/corpus";
import { search } from "@/lib/leads";
import { normalise, readProduct } from "@/lib/product";

/* Cannot be prerendered — the URL is only known at request time — but the
   result IS cacheable: it is a pure function of the pasted URL and the corpus,
   the same for every visitor. See next.config.ts for why that matters. */
export const dynamic = "force-dynamic";

export default async function Find({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  const clean = normalise(url ?? "");
  /* Unreadable is a state with its own page, not a bounce back to the form with
     a query string — that would make the home page dynamic for everyone in
     order to serve a message to one person. */
  if (!clean) return <Unreadable given={url ?? ""} why="That does not look like a web address." />;

  const read = await readProduct(clean);
  if (!read) {
    return (
      <Unreadable
        given={clean}
        why="We could not fetch that page, or it did not return HTML. Some sites block anything that is not a browser."
      />
    );
  }

  /* Postgres first — it holds everything the nightly cron has added since the
     last deploy — but only to narrow the field. The ranking is the artifact's,
     applied to whichever set came back, so both paths order results the same
     way. The bundled artifact is the floor: if the database is cold,
     unreachable or unconfigured the page still answers, rather than rendering
     an empty result with a 200. */
  const live = await search(read.weighted, 300);
  const all: Hit[] = live?.length ? rank(read.terms, 60, live) : rank(read.terms, 60);
  /* Strong first, and only a taste of the tail. With a corpus this size most
     products have one real match and a long shadow of near-misses; showing all
     of them buries the one that matters and makes the good one look like noise. */
  const strong = all.filter((h) => band(all, h) !== "loose");
  const weak = all.filter((h) => band(all, h) === "loose");
  const hits = [...strong, ...weak.slice(0, 6)];
  const hidden = weak.length - Math.min(6, weak.length);
  const exact = all.filter((h) => band(all, h) === "strong").length;

  /* Nothing strong means nothing. The count of everything that shares a word
     is not a count of people who want your product, and printing "60 people
     asked for something like this" above six coincidences is the site lying
     about its own results — a hackathon page got exactly that, over a comment
     about entering tunnels in a game. */
  const nothingReal = strong.length === 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-10 pb-20 sm:px-6">
      <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-accent">
        ← Try another
      </Link>

      <header className="mt-7 border-b border-rule pb-6">
        <p className="text-[11px] tracking-[0.2em] text-faint uppercase">We read your page as</p>
        <h1 className="mt-2 text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
          {read.title}
        </h1>
        {read.blurb && <p className="prose-tight mt-2 max-w-prose text-body">{read.blurb}</p>}
        <p className="mt-4 flex flex-wrap gap-1.5">
          {read.weighted.slice(0, 12).map((t) => (
            <span key={t} className="rounded-full border border-rule px-2.5 py-1 font-mono text-xs text-muted">
              {t}
            </span>
          ))}
        </p>
        {/* The ranking is term overlap, so the terms have to be visible. If we
            read the product wrong, the reader can see that immediately rather
            than wondering why the results are odd. */}
        <p className="mt-3 text-xs text-faint">
          These are the words we matched on. Wrong? Point us at the page that describes
          what you built.
        </p>
      </header>

      {hits.length === 0 || nothingReal ? (
        <Empty host={read.host} closest={hits.slice(0, 4)} />
      ) : (
        <>
          {/* Three states, because there are three truths. Something strong;
              nothing strong but some overlap, which is worth saying out loud
              rather than dressing up; and nothing, handled above. */}
          {exact > 0 ? (
            <p className="mt-7 text-sm text-muted">
              <span className="text-ink">
                {strong.length} {strong.length === 1 ? "person" : "people"}
              </span>{" "}
              asked for something like this ·{" "}
              <span className="text-good">{exact} worth reading first</span>
            </p>
          ) : (
            <p className="mt-7 max-w-prose text-sm text-muted">
              <span className="text-ink">Nothing here is a strong match.</span> These{" "}
              {strong.length} share vocabulary with your page, but none of them is
              clearly asking for what you built.
            </p>
          )}
          <ol className="mt-4">
            {hits.map((h) => (
              <LeadRow key={h.lead.id} hit={h} band={band(hits, h)} />
            ))}
          </ol>
          {hidden > 0 && (
            <p className="mt-5 text-sm text-muted">
              {hidden} weaker {hidden === 1 ? "match" : "matches"} not shown — they shared
              a word with you, not a need.
            </p>
          )}
          <p className="mt-8 text-xs text-faint">
            The tag on each row is the rare word you and they both used — that is a
            fact, not a judgement, so you can see in a glance whether it is relevant.
            Ranked by how uncommon those shared words are, and by whether the ask reads
            like a person wanting a product rather than someone stuck on a bug.
          </p>
        </>
      )}
    </main>
  );
}

function Empty({ host, closest = [] }: { host: string; closest?: Hit[] }) {
  return (
    <div className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">Nobody in here asked for this.</h2>
      <p className="prose-tight mt-3 max-w-prose text-body">
        That is a real answer, not an error. Nothing in the bank is about what{" "}
        {host} does. Either you are early, the words on your page are not the words
        your customers would use, or what you built is not the kind of thing people
        ask strangers for.
      </p>
      {closest.length > 0 && (
        <>
          <p className="mt-8 text-sm text-muted">
            The nearest things we have. None of these is a match — they share a word
            with you, not a need.
          </p>
          <ol className="mt-3 opacity-60">
            {closest.map((h) => (
              <LeadRow key={h.lead.id} hit={h} band="loose" />
            ))}
          </ol>
        </>
      )}
      <p className="mt-8">
        <Link href="/bank" className="text-sm text-accent underline underline-offset-4">
          Browse what people are asking for →
        </Link>
      </p>
    </div>
  );
}

function Unreadable({ given, why }: { given: string; why: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-16 pb-20 sm:px-6">
      <p className="text-[11px] tracking-[0.2em] text-faint uppercase">Could not read it</p>
      {/* Announced, not merely shown. Without this a screen reader user gets a
          new page with no signal that anything went wrong. */}
      <h1 role="alert" className="mt-4 text-3xl leading-tight font-semibold tracking-tight">
        {why}
      </h1>
      {given && <p className="mt-3 font-mono text-sm break-all text-muted">{given}</p>}
      <p className="prose-tight mt-5 max-w-prose text-body">
        Try the exact URL of the page that says what you built — a landing page or a
        README works better than a dashboard behind a login.
      </p>
      <form action="/find" className="mt-7 flex flex-col gap-3 sm:flex-row">
        <input
          name="url" type="text" inputMode="url" required autoFocus
          defaultValue={given} placeholder="yourproduct.com"
          aria-label="Your product's web address"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-surface px-4 py-3.5 font-mono text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <button className="rounded-xl bg-accent px-7 py-3.5 text-sm font-medium text-ground">
          Try again
        </button>
      </form>
      <p className="mt-6">
        <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-accent">
          ← Back
        </Link>
      </p>
    </main>
  );
}

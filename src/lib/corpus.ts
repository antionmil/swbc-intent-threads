import "server-only";
import { clipped } from "@/lib/readable";
import raw from "@/data/corpus.json";

/**
 * The corpus, and the arithmetic that ranks it.
 *
 * No database and no model in the request path. Both were tempting and both
 * were wrong here: the data is identical for every visitor, so it belongs in a
 * static artifact (Neon scales to zero after five minutes and a cold query
 * would be the slowest thing on the page), and a generated "why this matched"
 * sentence is a claim the reader cannot check. Term overlap can be shown in
 * the person's own words, highlighted, which is verifiable instead.
 */
export type Lead = {
  id: string; src: "hn" | "github" | "youtube"; who: string; repo: string;
  when: string; wish: string; url: string; score: number; t: string[];
  /** The video a YouTube comment sits under. Without it the comment is not
   *  legible — and it is where the matched terms came from. */
  ctx?: string;
  /** Only where a real one exists: GitHub and YouTube have them, Hacker News
   *  has none, and a stand-in photograph for a real named person is not a
   *  placeholder, it is a fabrication. Those get a monogram instead. */
  avatar?: string;
};

export const LEADS = (raw as Lead[]).map((l) => ({
  ...l,
  /* The artifact stores what the person typed, markdown and all. */
  wish: clipped(l.wish),
  /* A GitHub avatar is a pure function of the handle, so the bundled artifact
     gets faces too — the fallback path is not a degraded-looking page. YouTube
     avatars are per-comment and only exist in the database. */
  avatar: l.avatar ?? (l.src === "github" ? `https://github.com/${l.who}.png?size=96` : undefined),
}));

/* Inverse document frequency, computed once per cold start over ~1,300 rows.
   Without it "app", "tool" and "data" drown out the words that actually
   distinguish one product from another. */
export const DF = new Map<string, number>();
for (const l of LEADS) for (const t of l.t) DF.set(t, (DF.get(t) ?? 0) + 1);
const N = LEADS.length;
export const idf = (t: string) => Math.log(1 + N / (1 + (DF.get(t) ?? 0)));

/* Common English, held out of matching entirely.
 *
 * IDF alone cannot do this job on a corpus this size: it measures rarity HERE,
 * not whether a word carries meaning. In 1,905 leads "enter" scores 5.61 and
 * "goes" 5.36 — both higher than "scheduling" at 5.25 — so a hackathon page
 * saying "free to enter" matched a comment about entering tunnels in a game.
 * Rarity in a small corpus is mostly an accident of sample size, and ordinary
 * verbs are exactly where it misleads. */
const STOP = new Set(
  ("a about above across after again against all almost alone along already also although always am among an and " +
   "another any anyone anything are around as at away back be became because become been before began behind being " +
   "below beside best better between beyond big both but by came can cannot come comes coming could did different " +
   "do does doing done down during each early either else end enough enter entered enters even ever every everyone " +
   "everything except far few find finds first for found from full further gave get gets getting give given gives " +
   "go goes going gone good got great had half has have having he her here hers herself him himself his how however " +
   "i if in indeed inside instead into is it its itself just keep kept know known large last later least leave left " +
   "less let like likely little long look looking lot made make makes making many may maybe me mean means might mine " +
   "more most much must my myself near need needed needs neither never new next no none nor not nothing now of off " +
   "often on once one only onto or other others otherwise our ours out over own part per perhaps place put quite " +
   "rather really right run said same saw say says see seem seems seen set several shall she should show shows since " +
   "small so some someone something sometimes soon still such sure take taken takes than that the their them then " +
   "there these they thing things think this those though three through thus time to together too took toward turn " +
   "two under until up upon us use used uses using usually very want wanted wants was way ways we well went were " +
   "what when where whether which while who whole whom whose why will with within without work working works would " +
   "yet you your yours " +
   // words every landing page and every ask contains, which say nothing
   "free open source software product tool app apps page site website home pricing price features feature docs blog " +
   "login signup start started learn contact privacy terms cookie team teams user users customer customers business " +
   "solution solutions platform service services simple easy fast better best help support build built building " +
   "create created creates add added adding change changed try tried trying works working thanks thank hello hey")
    .split(" "),
);

export function terms(s: string): string[] {
  return (s.toLowerCase().match(/[a-z][a-z0-9+.#-]{2,24}/g) ?? [])
    /* Trailing punctuation was surviving tokenisation, so "users." and "users"
       were two different words and the first matched nothing. */
    .map((w) => w.replace(/[.\-+#]+$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export type Hit = { lead: Lead; score: number; shared: string[] };

/**
 * Rank the corpus against a product's own words.
 *
 * Quality multiplies rather than adds. A lead that shares three good terms but
 * reads as a support question inside somebody's repo should not outrank a
 * weaker overlap from a person describing a product they wish existed — the
 * whole value is that these are people worth writing to.
 */
export function rank(queryTerms: string[], limit = 24, over: Lead[] = LEADS): Hit[] {
  const q = new Map<string, number>();
  for (const t of queryTerms) q.set(t, (q.get(t) ?? 0) + 1);

  /* Match on what makes the product distinctive, not on its adjectives: every
     landing page says "simple" and "fast", and matching on those pulled in a
     comment about Google Photos.

     But rarity has to be measured among words that EXIST here. A word the
     corpus has never seen scores maximum IDF and can never match anything, so
     sorting by IDF alone promoted "cookieless" and "self-hostable" over
     "analytics" and left the useful terms outside the cut. */
  const qTerms = [...q.keys()]
    .filter((t) => (DF.get(t) ?? 0) > 0)
    .sort((a, b) => idf(b) - idf(a))
    .slice(0, 16);
  if (qTerms.length === 0) return [];

  /* What the page is ABOUT, as opposed to what it merely contains.
   *
   * A match has to touch one of these or it does not count. Without it, a
   * vibecoding hackathon matched a comment about entering tunnels in a game,
   * on the shared words "enter" and "goes" — the page did contain them, but
   * the page is about a hackathon. The subject words here were "hackathon",
   * "vibecoding" and "prize", none of which appear anywhere in the corpus, and
   * the honest answer in that case is that nobody has asked for this. */
  const core = new Set(
    [...q.entries()]
      .filter(([t]) => (DF.get(t) ?? 0) > 0)
      .sort((a, b) => b[1] - a[1] || idf(b[0]) - idf(a[0]))
      .slice(0, 8)
      .map(([t]) => t),
  );

  /* Term frequency on the product's own page, log-damped. This was missing and
     it was the whole bug: Plausible's page says "ditch Google Analytics" once
     and "analytics" twenty times, but IDF alone scored `ditch` and `analytics`
     identically because both are rare HERE. Rarity says a word is
     informative; frequency says the page is about it. You need both. */
  const tf = (t: string) => 1 + Math.log(1 + (q.get(t) ?? 0));
  const w = (t: string) => idf(t) * tf(t);
  const norm = Math.sqrt(qTerms.reduce((a, t) => a + w(t) ** 2, 0)) || 1;
  const out: Hit[] = [];

  for (const lead of over) {
    const set = new Set(lead.t);
    const shared = qTerms.filter((t) => set.has(t));
    if (shared.length === 0) continue;
    if (!shared.some((t) => core.has(t))) continue;
    /* Only the three rarest shared terms count. Summing all of them let a lead
       that happened to share eight generic words — tool, app, data, way — beat
       one that shared the single word the product is actually about. In this
       corpus "tool" carries an IDF of 1.26 and "analytics" carries 5.83, so
       breadth of vocabulary is mostly noise and rarity is the whole signal. */
    const best = shared.map(w).sort((a, b) => b - a).slice(0, 3);
    const overlap = best.reduce((a, v) => a + v, 0) / norm;
    const breadth = Math.sqrt(Math.min(shared.length, 4));
    /* Quality tilts, it does not decide. Multiplying by the raw score let a
       tidy-looking ask with a weak term match outrank the person who used the
       product's actual vocabulary. */
    const quality = 0.55 + 0.45 * lead.score;
    out.push({ lead, score: overlap * breadth * quality, shared });
  }
  out.sort((a, b) => b.score - a.score);

  /* A single shared common word is not a match, it is a coincidence, and a page
     of them buries the one lead that is real. Anything scoring under a fifth of
     the leader is dropped before it is ever shown. */
  const top = out[0]?.score ?? 0;
  return out.filter((h) => h.score >= top * 0.2).slice(0, limit);
}

/**
 * The words that caused the match, rarest first.
 *
 * This replaces a "exact match" badge, and the reason is honesty. Term overlap
 * cannot tell you two sentences MEAN the same thing — tested against real
 * products it was right about half the time, so a page that said "exact match"
 * was lying to every other reader. The overlapping word is a fact. Shown as
 * "matched on: bookmark", the reader judges relevance in a glance and is never
 * told something the arithmetic does not know.
 */
export function why(h: Hit, n = 2): string[] {
  return [...h.shared].sort((a, b) => idf(b) - idf(a)).slice(0, n);
}

/** Rank against a product read, keeping its term frequencies. */

/** How much weight to give the row, from the rarity of what it shares. */
export function band(hits: Hit[], h: Hit): "strong" | "worth a look" | "loose" {
  const top = hits[0]?.score ?? 0;
  if (top <= 0) return "loose";
  const r = h.score / top;
  /* Relative rank alone is not enough: when the best match is weak, everything
     near it inherits a label it has not earned. The absolute bar is the RAREST
     word the two have in common. Sharing "tool" and "check" is a coincidence at
     any rank; sharing "bookmark" or "analytics" is the thing itself.
     Measured on this corpus: generic terms sit at 1.2–4.2, the words a product
     is actually about sit above 5.4. */
  const rarest = Math.max(...h.shared.map(idf), 0);
  if (r >= 0.7 && rarest >= 5.0 && h.shared.length >= 2) return "strong";
  if (r >= 0.35 && rarest >= 4.2) return "worth a look";
  return "loose";
}

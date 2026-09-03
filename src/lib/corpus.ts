import "server-only";
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
  id: string; src: "hn" | "github"; who: string; repo: string;
  when: string; wish: string; url: string; score: number; t: string[];
};

export const LEADS = raw as Lead[];

/* Inverse document frequency, computed once per cold start over ~1,300 rows.
   Without it "app", "tool" and "data" drown out the words that actually
   distinguish one product from another. */
export const DF = new Map<string, number>();
for (const l of LEADS) for (const t of l.t) DF.set(t, (DF.get(t) ?? 0) + 1);
const N = LEADS.length;
export const idf = (t: string) => Math.log(1 + N / (1 + (DF.get(t) ?? 0)));

const STOP = new Set(
  ("a an the and or but if then than that this these those is are was were be been being have has had do does did " +
   "for to of in on at by with from as it its you your we our they their i me my not no so such can could would " +
   "should will just about into over under out up down more most other some any each which who what when where why " +
   "how all both few own same too very use using used get make made like want need way thing really much also even " +
   "still back new good great best better able free open source software product tool app page site website home " +
   "pricing features docs blog login sign up start get started learn more contact about us privacy terms cookie")
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
export function rank(queryTerms: string[], limit = 24): Hit[] {
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

  const norm = Math.sqrt(qTerms.reduce((a, t) => a + idf(t) ** 2, 0)) || 1;
  const out: Hit[] = [];

  for (const lead of LEADS) {
    const set = new Set(lead.t);
    const shared = qTerms.filter((t) => set.has(t));
    if (shared.length === 0) continue;
    /* Only the three rarest shared terms count. Summing all of them let a lead
       that happened to share eight generic words — tool, app, data, way — beat
       one that shared the single word the product is actually about. In this
       corpus "tool" carries an IDF of 1.26 and "analytics" carries 5.83, so
       breadth of vocabulary is mostly noise and rarity is the whole signal. */
    const best = shared.map(idf).sort((a, b) => b - a).slice(0, 3);
    const overlap = best.reduce((a, v) => a + v, 0) / norm;
    const breadth = Math.sqrt(Math.min(shared.length, 4));
    out.push({ lead, score: overlap * breadth * lead.score, shared });
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

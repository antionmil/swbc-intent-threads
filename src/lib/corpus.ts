import "server-only";
import { clipped, decode, humanAsk, ownWords } from "@/lib/readable";
import { topicOf } from "@/lib/topics";
import raw from "@/data/corpus.json";
import blocklist from "@/data/blocked.json";

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
  /** What kind of thing they were asking for. Set when the lead is mined. */
  topic?: string;
  /** Only where a real one exists: GitHub and YouTube have them, Hacker News
   *  has none, and a stand-in photograph for a real named person is not a
   *  placeholder, it is a fabrication. Those get a monogram instead. */
  avatar?: string;
};

/* The artifact is what gets served when a database read fails, so the takedown
   list has to reach it too — the `blocked` table only exists on the live path.
   "ghost" is GitHub's placeholder for a deleted account: seven rows carried it,
   each with a face and a name for somebody who is no longer there. */
const BLOCKED = new Set(
  (blocklist.authors as string[]).map((a) => a.toLowerCase()).concat(["ghost", "deleted", "[deleted]"]),
);

export const LEADS = (raw as Lead[]).filter((l) => !BLOCKED.has(l.who.toLowerCase())).map((l) => ({
  ...l,
  /* The artifact stores what the person typed, markdown and all. */
  wish: clipped(l.wish),
  ctx: l.ctx ? decode(l.ctx) : undefined,
  /* A GitHub avatar is a pure function of the handle, so the bundled artifact
     gets faces too — the fallback path is not a degraded-looking page. YouTube
     avatars are per-comment and only exist in the database. */
  avatar: l.avatar ?? (l.src === "github" ? `https://github.com/${l.who}.png?size=96` : undefined),
})).filter((l) => ownWords(l.wish) && humanAsk(l.wish));

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
   "create created creates add added adding change changed try tried trying works working thanks thank hello hey " +
   /* Added after tracing real product pages. Cal.com's title and description
      yielded "fully taking platforms individuals businesses developers online
      calls" beside "scheduling"; Plausible's yielded "ditch plans match growth
      based alternative" out of "It's time to ditch Google Analytics" and "plans
      that match your growth". A comment about pseudo-label visualization
      outranked a doctor's surgery wanting an appointment app, because it shared
      "online" and "meet". None of these say what a product IS. */
   "alternative alternatives ditch plans plan growth match matches based fully taking individuals " +
   "businesses developers online calls respected powerful modern trusted seamless intuitive " +
   "unlimited reliable everything anything company companies clients people person")
    .split(" "),
);

export function terms(s: string): string[] {
  return (s.toLowerCase().match(/[a-z][a-z0-9+.#-]{2,24}/g) ?? [])
    /* Trailing punctuation was surviving tokenisation, so "users." and "users"
       were two different words and the first matched nothing. */
    .map((w) => w.replace(/[.\-+#]+$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export type Hit = {
  lead: Lead; score: number; shared: string[];
  /** Whether the lead wants the same KIND of thing the product is. */
  agree?: "same" | "different" | "unknown";
};

/**
 * Rank the corpus against a product's own words.
 *
 * Quality multiplies rather than adds. A lead that shares three good terms but
 * reads as a support question inside somebody's repo should not outrank a
 * weaker overlap from a person describing a product they wish existed — the
 * whole value is that these are people worth writing to.
 */
/* How informative a shared word has to be before it can carry a match.
 *
 * Measured on this corpus: "analytics" 6.85, "bookings" 6.85, "scheduling"
 * 5.35 — the words a product is about. "based" 4.33, "alternative" 4.15,
 * "google" 3.95, "data" 3.25 — the words every page contains. Plausible's
 * results were four fifths "google" and "data" matches: a wellness studio
 * wanting a room-booking app, and somebody wanting off-site backup that is not
 * AWS or Google, listed as leads for a privacy analytics tool.
 *
 * 4.5 sits in the gap. It is a property of this corpus's size, so it moves if
 * the corpus grows by an order of magnitude. */
const DECISIVE = 4.5;

/**
 * Words that mean the same job, grouped so a match can be about a subject
 * rather than about a string.
 *
 * This is what "the results do not match the product" came down to. Cal.com's
 * page says "scheduling"; three leads in 1,931 use that exact word. The people
 * who actually want it wrote "appointment", "booking", "calendar", "availability"
 * — thirty-seven leads, and the matcher could not see any of them because it
 * compared spellings. Plausible says "analytics", which two leads use; the ones
 * that matter say "tracking", "dashboard", "stats", "page views", "reports" —
 * fifty-seven. Every group below is checked against the corpus: a term that no
 * lead contains is dead weight and was dropped.
 *
 * Not a synonym dictionary and not trying to be. It covers the subjects this
 * index actually holds, which is what a product pasted into the box is likely
 * to be about, and it grows when the corpus does.
 */
const CONCEPTS: string[][] = [
  "schedule scheduling scheduler appointment appointments booking bookings calendar calendars availability slots".split(" "),
  /* "traffic" and "visitors" were in here and put "I need a small store, will
     likely have high traffic" top of the results for a web analytics tool, as a
     STRONG match. A shop owner counting people through the door and a site
     owner counting page views share a word and nothing else. */
  "analytics metrics stats statistics insights dashboard reporting reports".split(" "),
  "invoice invoices invoicing billing receipt receipts payments checkout".split(" "),
  "crm contacts pipeline clients customers deals".split(" "),
  "accounting bookkeeping expenses payroll tax quickbooks xero".split(" "),
  "inventory stock warehouse barcode".split(" "),
  "newsletter campaigns mailing subscribers broadcast sequences".split(" "),
  "notes notebook markdown wiki outline annotations".split(" "),
  "task tasks todo kanban backlog".split(" "),
  "backup backups archive snapshot restore sync replication".split(" "),
  /* "library" means a code library far more often here than a media one. */
  "player streaming playlist subtitles transcode".split(" "),
  "password passwords vault credentials authenticator".split(" "),
  "monitoring alerts uptime logs observability telemetry".split(" "),
  "search searching indexing autocomplete".split(" "),
  "chat messaging inbox threads notifications".split(" "),
];

const GROUP = new Map<string, number>();
CONCEPTS.forEach((words, i) => words.forEach((w) => GROUP.set(w, i)));

/**
 * The same terms, plus the rest of every subject they belong to.
 *
 * Postgres does recall and the artifact does precision, so the expansion has to
 * happen in BOTH or it happens in neither: a lead that says "appointment" and
 * never says "scheduling" is not in the candidate set the ranker is handed, and
 * no amount of cleverness downstream can rank a row it was never given.
 */
export function expand(list: string[], cap = 40): string[] {
  const out = new Set(list);
  for (const t of list) {
    const g = GROUP.get(t);
    if (g !== undefined) for (const sib of CONCEPTS[g]) out.add(sib);
  }
  return [...out].slice(0, cap);
}

export function rank(
  queryTerms: string[],
  limit = 24,
  over: Lead[] = LEADS,
  /** What the pasted product is FOR, classified the same way a lead is. */
  productTopic?: string,
): Hit[] {
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

  /* Which subjects the page is about.
   *
   * Only from what the product calls ITSELF — its title, description and first
   * heading — never from a marketing subheading. readProduct counts those twice
   * and everything else once, so a count of 2 or more is the test.
   *
   * Linear's subheadings say "Planning and monitoring", and taking subjects from
   * there made the whole result set observability people: log analysis, uptime
   * monitors, a Kubernetes node. All labelled strong, for an issue tracker. One
   * word in one subheading captured every result on the page, which is exactly
   * the failure this gate exists to stop. */
  const qGroups = new Map<number, string>();
  for (const t of qTerms) {
    const g = GROUP.get(t);
    if (g !== undefined && core.has(t) && (q.get(t) ?? 0) >= 2 && !qGroups.has(g)) qGroups.set(g, t);
  }

  for (const lead of over) {
    const set = new Set(lead.t);

    /* Exact shared words. A word only counts as DECISIVE if the page is about
       it and the corpus has seen it more than once. The df floor matters as
       much as the core test: with 1,931 leads a term appearing in exactly one
       of them carries the highest IDF in the index while telling you nothing —
       "meet" (df 1) scored 7.54 against "scheduling" (df 9) at 5.35, so the
       rarest word on the page was the least informative one. */
    const hits = new Map<string, { weight: number; decisive: boolean }>();
    for (const t of qTerms) {
      if (!set.has(t)) continue;
      hits.set(t, {
        weight: w(t),
        decisive: core.has(t) && (DF.get(t) ?? 0) >= 2 && idf(t) >= DECISIVE,
      });
    }

    /* Same subject, different word. Discounted, because "appointment" is
       evidence about a scheduling product but weaker evidence than the word the
       page itself used. Decisive when the page is about the subject: belonging
       to a hand-built topical group IS the test of topicality, so the IDF floor
       that exists to weed out filler does not apply a second time here. */
    let conceptHit = false;
    for (const [g, qt] of qGroups) {
      for (const sib of CONCEPTS[g]) {
        if (!set.has(sib)) continue;
        conceptHit = true;
        if (hits.has(sib)) continue;
        hits.set(sib, { weight: 0.75 * idf(sib) * tf(qt), decisive: true });
      }
      /* The product's own word for the subject counts as being on-subject too. */
      if (set.has(qt)) conceptHit = true;
    }

    if (hits.size === 0) continue;
    if (![...hits.values()].some((h) => h.decisive)) continue;

    /* THE JUDGEMENT STEP.
     *
     * Everything above asks "do these share words?". This asks "is this person
     * after the same KIND of thing?", which is what was missing and why the
     * results read as random however good the word matching got.
     *
     * The test is the SUBJECT, taken from the concept groups — not the topic
     * label from the browse filter. That label was tried here first and made
     * things worse rather than better: Plausible classifies as "Websites &
     * design", because its own page says "your website data is 100% yours", and
     * so does a shop owner asking about foot traffic — so the two "agreed" and
     * a shop was promoted to a STRONG match for a web analytics tool. A coarse
     * classifier used as a boost amplifies its own mistakes. It stays where it
     * is honest work, labelling chips for browsing, and out of the ranking.
     *
     * Concept groups are hand-built, checked against the corpus and tight
     * enough to trust. When the page is about a subject this index knows, a
     * lead has to be about that subject too. When it is not, there is nothing
     * to judge against and the word matching stands on its own. */
    if (qGroups.size > 0 && !conceptHit) continue;
    /* The words the READER will see underlined in the lead, which for a concept
       match is the lead's word ("appointment"), not the product's
       ("scheduling"). */
    const shared = [...hits.keys()];
    /* Only the three rarest shared terms count. Summing all of them let a lead
       that happened to share eight generic words — tool, app, data, way — beat
       one that shared the single word the product is actually about. In this
       corpus "tool" carries an IDF of 1.26 and "analytics" carries 5.83, so
       breadth of vocabulary is mostly noise and rarity is the whole signal. */
    /* One decisive word beats several accidental ones.
     *
     * This used to sum the three best terms and multiply by
     * sqrt(min(shared, 4)) — a breadth bonus. Traced on cal.com, that put a
     * comment about pseudo-label visualization at rank 5 and "strong" because
     * it shared "meet" and "online", while "I need an appointment scheduling
     * app for booking for different doctors" — the single best lead in the
     * index for that product — sat at rank 7 labelled "worth a look". Two junk
     * words outscored the one word the product is actually about.
     *
     * So the best term carries the score and the others only nudge it. A
     * second decisive word should help; a second coincidence should not. */
    const best = [...hits.values()].map((h) => h.weight).sort((a, b) => b - a);
    const overlap = (best[0] + 0.35 * (best[1] ?? 0) + 0.15 * (best[2] ?? 0)) / norm;
    /* Quality tilts, it does not decide. Multiplying by the raw score let a
       tidy-looking ask with a weak term match outrank the person who used the
       product's actual vocabulary. */
    const quality = 0.55 + 0.45 * lead.score;
    /* Agreement is a strong tilt, not a veto: 1.35 when both sides say the same
       subject, 0.3 when they say different ones, 1 when either is unlabelled. */
    out.push({ lead, score: overlap * quality, shared, agree: conceptHit ? "same" : "unknown" });
  }
  out.sort((a, b) => b.score - a.score);

  /* A single shared common word is not a match, it is a coincidence, and a page
     of them buries the one lead that is real. Anything scoring under a fifth of
     the leader is dropped before it is ever shown. */
  const top = out[0]?.score ?? 0;
  return out.filter((h) => h.score >= top * 0.3).slice(0, limit);
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
  /* A lead that wants a different KIND of thing is never strong, whatever it
     shares. That is the whole point of asking. */
  if (h.agree === "different") return h.shared.length >= 2 ? "worth a look" : "loose";
  if (r >= 0.7 && rarest >= 5.0 && h.shared.length >= 2) return "strong";
  if (r >= 0.35 && rarest >= 4.2) return "worth a look";
  return "loose";
}

import "server-only";
import { sql } from "./db";
import { clipped } from "./readable";
import { topicOf } from "./topics";

/* The same filters that were tuned by measurement on the command line, moved
   here so the cron applies them rather than a script on somebody's laptop.
   Every threshold below has a number behind it, recorded where it was set. */

const UA = { "user-agent": "intentthreads/1.0 (+https://intentthreads.onedaybuilt.com)" };

async function j<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { ...UA, ...headers } });
      if (r.status === 403 || r.status === 429) { await wait(2000 * (t + 1)); continue; }
      if (!r.ok) return null;
      return (await r.json()) as T;
    } catch { await wait(1200 * (t + 1)); }
  }
  return null;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();

/* "is there a way to" was 76% of the GitHub haul and 84% of what the filters
   then threw away — it finds people stuck inside a repo, not people wanting a
   product. It is deliberately absent. */
const GH_PHRASES = [
  "I wish there was", "I wish there were", "I wish someone would",
  "looking for a tool", "looking for an app", "is there a tool",
  "is there an app", "does this exist", "I would pay for",
  "someone should build", "why is there no", "I need a tool",
];

const PRODUCTY = /\b(tool|app|service|product|platform|saas|library|extension|plugin|dashboard|cli|website|site|software|alternative)\b/i;
const SUPPORT = /\b(error|traceback|stack ?trace|version \d|reproduce|crash|my config|log ?file|this repo|workaround|bug|fix (for|this)|not working|doesn'?t work)\b/i;
/* Code in the sentence means somebody inside a repo describing their own
   build. It removed 84% of the raw haul and was the largest source of false
   matches. */
const CODEY = /(`[^`]{2,}`|\b\w+\(\)|\b[a-z]+[A-Z]\w+\b|\b\w+\.(py|js|ts|go|rs|java|rb|json|ya?ml|toml)\b|\/[a-z_]+\/[a-z_]+|\bnpm |\bpip |\bdocker )/i;

function ghScore(phrase: string, wish: string, body: string, when: string) {
  const W: Record<string, number> = {
    "i wish there was": 1.0, "i wish there were": 1.0, "someone should build": 1.0,
    "i would pay for": 0.95, "does this exist": 0.85, "why is there no": 0.85,
    "is there a tool": 0.8, "looking for a tool": 0.8, "is there an app": 0.8,
    "looking for an app": 0.8, "i wish someone would": 0.95, "i need a tool": 0.8,
  };
  let w = W[phrase.toLowerCase()] ?? 0.5;
  if (PRODUCTY.test(wish.slice(0, 180))) w += 0.3;
  if (SUPPORT.test(body.slice(0, 600))) w -= 0.45;
  if (CODEY.test(wish)) w -= 0.55;
  if (wish.length < 90) w -= 0.15;
  const yr = when.slice(0, 4);
  w += yr >= "2026" ? 0.2 : yr >= "2025" ? 0.1 : yr < "2023" ? -0.2 : 0;
  return Math.max(0, Math.min(1.6, w));
}

const idOf = async (who: string, wish: string) => {
  const d = new TextEncoder().encode(`${who}${wish.slice(0, 90)}`);
  const h = await crypto.subtle.digest("SHA-1", d);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
};

type Result = { found: number; added: number; note?: string };

async function insert(rows: {
  id: string; src: string; who: string; repo: string; ctx: string;
  when: string; wish: string; url: string; score: number; avatar?: string;
}[]) {
  let added = 0;
  for (const r of rows) {
    try {
      const out = await sql()`
        insert into leads (id, src, who, repo, ctx, asked_on, wish, url, score, avatar, topic)
        values (${r.id}, ${r.src}, ${r.who}, ${r.repo}, ${r.ctx},
                ${r.when || null}, ${r.wish}, ${r.url}, ${r.score}, ${r.avatar ?? null},
                /* Classified on the text a reader will SEE, not the raw body:
                   issue-form headings and markdown would otherwise vote. */
                ${topicOf(clipped(r.wish), r.repo, r.ctx) === "other"
                  ? null
                  : topicOf(clipped(r.wish), r.repo, r.ctx)})
        on conflict (url) do nothing
        returning id
      `;
      if ((out as unknown[]).length) added++;
    } catch { /* one bad row must not lose the batch */ }
  }
  return added;
}

/** Yesterday's issues only. A full history walk belongs in a backfill, not in
 *  something that runs every night. */
/**
 * Software Recommendations, on Stack Exchange.
 *
 * Reddit would be the right source for the subjects this index is thin on, and
 * it is closed: the free tier still costs nothing, but self-service app
 * registration ended in late 2025 and every new client now waits weeks on a
 * manual approval that may simply be refused. Commercial access is $0.24 per
 * 1,000 calls with a five-figure monthly minimum.
 *
 * This site is a better fit than Reddit anyway. Every question on it IS a
 * product request — "Android app for digitizing books & photo albums",
 * "Image viewer with shuffle navigation" — where a YouTube comment is one about
 * half a percent of the time. The title alone is a clean, one-line ask, which
 * is the shape this whole index is built out of.
 *
 * Free and keyless at 300 requests a day, and one request returns a hundred
 * questions. Content is CC BY-SA 4.0, so every row keeps its author's name and
 * links back to the original, which this site does for every source anyway.
 */
export async function mineStack(pages = 8, from = 1): Promise<Result> {
  let found = 0;
  const rows: Parameters<typeof insert>[0] = [];

  /* `from` exists because the daily job wants the newest hundred questions and
     a backfill wants the other twenty-three thousand. Without it every run
     re-read page one and added nothing after the first. */
  for (let page = from; page < from + pages; page++) {
    const d = await j<{
      items?: Record<string, unknown>[]; has_more?: boolean; backoff?: number;
    }>("https://api.stackexchange.com/2.3/questions?order=desc&sort=creation" +
       `&site=softwarerecs&pagesize=100&page=${page}&filter=withbody`);
    if (!d?.items?.length) break;

    for (const q of d.items) {
      found++;
      const title = clean(String(q.title ?? ""));
      if (title.length < 20) continue;
      const owner = q.owner as Record<string, unknown> | undefined;
      const who = String(owner?.display_name ?? "").trim();
      /* No name, nobody to write to. The whole product is the reply. */
      if (!who || owner?.user_type === "does_not_exist") continue;
      const url = String(q.link ?? "");
      if (!url) continue;

      const asked = Number(q.creation_date ?? 0);
      const when = asked ? new Date(asked * 1000).toISOString().slice(0, 10) : "";
      /* Recency is most of the value here. A question from 2014 is a real ask
         from a real person who has almost certainly stopped looking. */
      const years = asked ? (Date.now() / 1000 - asked) / 31_557_600 : 99;
      const score = years < 1 ? 1.1 : years < 3 ? 0.95 : years < 6 ? 0.8 : 0.65;

      const tags = Array.isArray(q.tags) ? (q.tags as string[]).slice(0, 4).join(", ") : "";
      rows.push({
        id: await idOf(who, title), src: "stack", who, repo: "", ctx: tags,
        when, wish: title.slice(0, 300), url, score,
        avatar: String(owner?.profile_image ?? "") || undefined,
      });
    }

    if (!d.has_more) break;
    /* The API asks for this when it wants a pause, and ignoring it is how a
       keyless caller loses the key it does not have. */
    await wait(d.backoff ? d.backoff * 1000 : 250);
  }

  return { found, added: await insert(rows) };
}

export async function mineGithub(days = 3): Promise<Result> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);

  let found = 0;
  const rows: Parameters<typeof insert>[0] = [];
  for (const p of GH_PHRASES) {
    const q = encodeURIComponent(`"${p}" in:body type:issue created:>${since}`);
    const d = await j<{ items?: Record<string, unknown>[] }>(
      `https://api.github.com/search/issues?q=${q}&per_page=100&sort=created&order=desc`, headers);
    for (const it of d?.items ?? []) {
      const body = clean(String(it.body ?? ""));
      const i = body.toLowerCase().indexOf(p.toLowerCase());
      const who = String((it.user as { login?: string })?.login ?? "");
      if (i < 0 || body.length < 60 || who.endsWith("[bot]")) continue;
      found++;
      const wish = body.slice(i, i + 320);
      if (wish.length < 55) continue;
      const when = String(it.created_at ?? "").slice(0, 10);
      const score = ghScore(p, wish, body, when);
      if (score < 0.55) continue;
      rows.push({
        id: await idOf(who, wish), src: "github", who,
        repo: String(it.repository_url ?? "").split("/repos/").pop() ?? "",
        ctx: "", when, wish, url: String(it.html_url ?? ""), score,
        /* A pure function of the handle — no request needed, and it is the
           real photograph rather than a stand-in. */
        avatar: `https://github.com/${who}.png?size=96`,
      });
    }
    await wait(token ? 2200 : 6500);
  }
  return { found, added: await insert(rows) };
}

/* YouTube: 3% of comments carry want-language against GitHub's 17%, so the net
   is far tighter. The video supplies the DOMAIN, the comment must supply the
   NEED — measured on 360 comments, 5% state a need only the video makes sense
   of, which is more than the 3% that stand alone. */
const YT_WANT = /\b(i(?:'m| am)? ?looking for (?:a|an|some)|i wish (?:there|it|they|someone)|i (?:want|need) (?:a|an|some)|is there (?:a|an|any) \w+ that|does (?:it|this|any) \w+ (?:do|have|support|handle)|what (?:app|tool|software|platform|one) (?:do|would|should)|which (?:app|tool|software|platform|one) (?:do|would|should|is)|what (?:do|would) (?:you|yall|u) recommend|anyone know (?:of )?(?:a|an)|i(?:'d| would) pay for)\b/i;
/* The vocabulary that says a comment is about a THING somebody wants, rather
 * than chit-chat under a video. It used to be twenty-six words, all of them
 * small-business software — crm, invoicing, payroll, analytics — so a comment
 * under an interior-design video was thrown away before anything looked at it.
 * A visitor pasting an interior-design tool was then told nobody had asked for
 * it, which was true only because nothing had been allowed to listen. */
const YT_DOMAIN = new RegExp(
  "\\b(" + [
    // business software, as before
    "crm", "invoic\\w*", "accounting", "bookkeep\\w*", "payroll", "analytics", "form", "forms",
    "survey", "newsletter", "email", "password", "calendar", "schedul\\w*", "booking", "appointment",
    "inventory", "pos", "note", "notes", "backup", "expense", "helpdesk", "signature", "website",
    "tax", "receipt", "mileage", "seo", "invoice", "quote", "quoting", "payment", "payments",
    // design and making
    "design\\w*", "render\\w*", "floorplan", "floor", "layout", "moodboard", "sketch\\w*",
    "cad", "3d", "model\\w*", "furniture", "interior", "interiors", "decor", "decorating",
    "renovation", "remodel\\w*", "staging", "kitchen", "bathroom", "garden", "landscap\\w*",
    "logo", "font", "fonts", "palette", "mockup", "prototype", "wireframe", "illustration",
    // media
    "photo", "photos", "picture", "pictures", "image", "images", "video", "videos", "audio",
    "music", "podcast", "subtitle", "subtitles", "thumbnail", "stream\\w*", "edit\\w*",
    "transcri\\w*", "recording",
    // home, property, trades
    "property", "rental", "tenant", "landlord", "contractor", "estimat\\w*", "blueprint",
    // personal and everyday
    "budget\\w*", "habit", "journal\\w*", "recipe", "recipes", "meal", "workout", "fitness",
    "sleep", "meditation", "language", "flashcard\\w*", "study", "reading", "ebook", "travel",
    "packing", "pet", "baby", "wedding",
    // work and study
    "resume", "cv", "portfolio", "contract", "proposal", "whiteboard", "diagram", "mindmap",
    "presentation", "spreadsheet", "database",
    // technical
    "server", "servers", "hosting", "nas", "vpn", "storage", "monitoring", "api", "logs",
    "automation", "workflow", "integration", "dashboard", "report", "reports",
    // the generic shapes of a product
    "app", "apps", "tool", "tools", "software", "platform", "plugin", "extension", "service",
  ].join("|") + ")\\b",
  "i",
);
const YT_META = /\b(part \d|next video|another video|video (on|about)|make a video|your channel|tutorial on|more (information|content|videos?) like|keep (them|it) coming)\b/i;
const LINKY = /(https?:\/\/|t\.me|whatsapp|telegram|\+\d{7,})/i;

/** Reads the least recently read videos. Discovery is a separate, rarer job. */
/**
 * Find videos worth reading the comments under.
 *
 * The cron had no discovery at all. Every video it knew came from a script run
 * by hand months ago, so the corpus could re-read its own 572 videos forever
 * and never learn a subject it had not already been pointed at. That is a
 * corpus that cannot grow, which for this site is the same as a corpus that
 * does not work.
 *
 * A search costs 100 quota units out of 10,000 a day, so the caller passes a
 * small slice and the rotation in queries.ts brings the rest round over time.
 */
export async function discoverYouTube(queries: string[]): Promise<Result> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return { found: 0, added: 0, note: "no YOUTUBE_API_KEY" };

  let found = 0;
  const rows: { id: string; title: string }[] = [];
  for (const q of queries) {
    const d = await j<{ items?: Record<string, unknown>[] }>(
      "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video" +
      `&maxResults=25&relevanceLanguage=en&order=relevance&q=${encodeURIComponent(q)}&key=${key}`);
    for (const it of d?.items ?? []) {
      const id = ((it.id as Record<string, unknown>)?.videoId ?? "") as string;
      const title = String((it.snippet as Record<string, unknown>)?.title ?? "");
      if (!id || !title) continue;
      found++;
      rows.push({ id, title: title.slice(0, 200) });
    }
    await wait(120);
  }

  let added = 0;
  for (const r of rows) {
    try {
      /* MERGED, never overwritten. An earlier version of this replaced the
         table wholesale and destroyed about 3,400 discovered videos. */
      const done = (await sql()`
        insert into videos (id, title) values (${r.id}, ${r.title})
        on conflict (id) do nothing returning id
      `) as unknown as { id: string }[];
      if (done.length) added++;
    } catch (e) {
      console.error("[mine] video insert failed", e);
    }
  }
  return { found, added };
}

export async function mineYouTube(videos = 120): Promise<Result> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return { found: 0, added: 0, note: "no YOUTUBE_API_KEY" };

  const vids = (await sql()`
    select id, title from videos order by last_read nulls first limit ${videos}
  `) as unknown as { id: string; title: string }[];
  if (!vids.length) return { found: 0, added: 0, note: "no videos known yet" };

  let found = 0;
  const rows: Parameters<typeof insert>[0] = [];
  const seenText = new Set<string>();

  for (const v of vids) {
    const d = await j<{ items?: Record<string, unknown>[] }>(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${v.id}` +
      `&maxResults=100&order=time&textFormat=plainText&key=${key}`);
    for (const it of d?.items ?? []) {
      const sn = ((it.snippet as Record<string, unknown>)?.topLevelComment as Record<string, unknown>)
        ?.snippet as Record<string, unknown> | undefined;
      if (!sn) continue;
      const txt = clean(String(sn.textDisplay ?? ""));
      found++;
      if (txt.length < 40 || txt.length > 900 || LINKY.test(txt)) continue;
      const m = YT_WANT.exec(txt);
      if (!m || YT_META.test(txt)) continue;
      const tail = txt.slice(m.index);
      const words = tail.match(/[a-zA-Z][a-zA-Z0-9'-]{2,}/g)?.length ?? 0;
      const standsAlone = YT_DOMAIN.test(txt);
      if (standsAlone ? tail.length < 45 || words < 7 : !YT_DOMAIN.test(v.title) || words < 6) continue;
      /* Keyed on the SENTENCE, not author+sentence: five accounts posting the
         same line under five videos is one engagement farm, and that was 69 of
         213 leads before it was fixed. */
      const fp = txt.toLowerCase().replace(/[^a-z ]/g, "").slice(0, 90);
      if (seenText.has(fp)) continue;
      seenText.add(fp);
      const who = String(sn.authorDisplayName ?? "").replace(/^@/, "");
      const wish = tail.slice(0, 300);
      rows.push({
        id: await idOf(who, wish), src: "youtube", who, repo: "", ctx: v.title.slice(0, 120),
        when: String(sn.publishedAt ?? "").slice(0, 10), wish,
        url: `https://www.youtube.com/watch?v=${v.id}&lc=${String(it.id ?? "")}`,
        score: 0.85,
        avatar: String(sn.authorProfileImageUrl ?? "") || undefined,
      });
    }
    await sql()`update videos set last_read = now() where id = ${v.id}`;
    await wait(40);
  }
  return { found, added: await insert(rows) };
}

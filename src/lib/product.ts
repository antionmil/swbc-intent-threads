import "server-only";
import { terms } from "./corpus";

/**
 * What a product says it is, taken from the product's own page.
 *
 * A model could summarise this better, but nothing here needs a model: a
 * product page states what it does in the title, the meta description and the
 * first heading, because that is what those elements are for. Reading them is
 * free, instant, and cannot hallucinate a description of somebody's business.
 */
export type Read = {
  url: string; host: string; title: string; blurb: string;
  terms: string[]; weighted: string[];
};

const pick = (html: string, re: RegExp) => (html.match(re)?.[1] ?? "").trim();
const strip = (s: string) =>
  s.replace(/<[^>]+>/g, " ")
   .replace(/&(#\d+|[a-z]+);/gi, " ")
   .split(/\s+/).join(" ").trim();

export function normalise(input: string): string | null {
  let u = input.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const p = new URL(u);
    if (p.protocol !== "https:" && p.protocol !== "http:") return null;
    /* No internal addresses. This fetches a URL a stranger supplied, so it must
       never be usable to probe the network the function runs in. */
    const h = p.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") ||
        /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.endsWith(".local")) return null;
    return p.toString();
  } catch { return null; }
}

export async function readProduct(url: string): Promise<Read | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let html = "";
  try {
    const r = await fetch(url, {
      signal: ctl.signal, redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; intentthreads/1.0; +https://intentthreads.onedaybuilt.com)" },
    });
    if (!r.ok) return null;
    const type = r.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;
    /* Cap the read. A product page is a few hundred KB; anything far past that
       is not a product page and should not be parsed on our clock. */
    html = (await r.text()).slice(0, 600_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  const title = strip(pick(html, /<title[^>]*>([\s\S]{0,300}?)<\/title>/i));
  const desc = strip(
    pick(html, /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]{0,400}?)["']/i) ||
    pick(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]{0,400}?)["']/i),
  );
  const h1 = strip(pick(html, /<h1[^>]*>([\s\S]{0,300}?)<\/h1>/i));
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]{0,200}?)<\/h2>/gi)]
    .slice(0, 6).map((m) => strip(m[1])).filter(Boolean);

  const host = new URL(url).hostname.replace(/^www\./, "");
  const blurb = [desc, h1].filter(Boolean).join(" — ").slice(0, 220);

  /* Title and description describe the product; h2s describe its features. Both
     matter, the first more, so the first is simply counted twice. */
  const strong = terms([title, desc, h1].join(" "));
  const weak = terms(h2s.join(" "));
  const all = [...strong, ...strong, ...weak];
  if (all.length < 3) return null;

  const freq = new Map<string, number>();
  for (const t of all) freq.set(t, (freq.get(t) ?? 0) + 1);

  return {
    url, host,
    title: title || host,
    blurb: blurb || "",
    terms: all,
    weighted: [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([t]) => t),
  };
}

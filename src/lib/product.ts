import "server-only";
import { unstable_cache } from "next/cache";
import { terms } from "./corpus";
import { decode } from "./readable";

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
  terms: string[]; weighted: string[]; key: string[]; name: string[];
};

const pick = (html: string, re: RegExp) => (html.match(re)?.[1] ?? "").trim();

/**
 * Read one meta tag's content, in a single linear pass.
 *
 * The two patterns this replaces were
 *   /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]{0,400}?)["']/i
 * and its og: twin. Two unbounded [^>]+ runs separated by a literal is
 * polynomial: for every starting position the engine can split the same stretch
 * of characters between them in n ways. Measured on 600KB of `<meta name="x" >`
 * repeated — a page anybody can serve from a URL they paste into this site —
 * the pair took 14.6s and 24.2s. Thirty-nine seconds of CPU, per request, from
 * one cheap HTTP response. The 8-second fetch timeout does not cover it: that
 * timeout guards the download, and this runs after the body is already in hand.
 *
 * Splitting the tag out first with /<meta\b[^>]*>/g is linear (one bounded run,
 * no ambiguity), and each tag it yields is short, so the attribute reads inside
 * it cannot blow up either. Same result, 3ms on the same payload.
 */
function metaContent(html: string, key: string): string {
  const wanted = key.toLowerCase();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const name = /\b(?:name|property)\s*=\s*["']([^"']{0,80})["']/i.exec(tag)?.[1];
    if (!name || name.trim().toLowerCase() !== wanted) continue;
    const content = /\bcontent\s*=\s*["']([^"']{0,400})["']/i.exec(tag)?.[1];
    if (content) return content;
  }
  return "";
}
/* decode(), not delete. This replaced every entity with a space, so a page
   titled "You&#39;re doing it wrong" was read back as "You re doing it wrong"
   and printed that way in the "We read your page as" headline. */
const strip = (s: string) =>
  decode(s.replace(/<[^>]+>/g, " ")).split(/\s+/).join(" ").trim();

/* Everything that is not the public internet. Ranges from RFC 1918, RFC 6598,
   RFC 3927, RFC 5737, RFC 2544 and the v6 equivalents — loopback, link-local
   (which is where every cloud metadata service lives), carrier-grade NAT,
   documentation ranges, multicast and reserved space. */
function privateAddress(ip: string): boolean {
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    /* ::ffff:10.0.0.1 is a v4 address wearing a v6 hat. */
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v);
    if (mapped) return privateAddress(mapped[1]);
    return (
      v === "::" || v === "::1" ||
      v.startsWith("fc") || v.startsWith("fd") ||   // unique local
      v.startsWith("fe8") || v.startsWith("fe9") ||
      v.startsWith("fea") || v.startsWith("feb") || // link-local
      v.startsWith("ff")                            // multicast
    );
  }
  const b = ip.split(".").map(Number);
  if (b.length !== 4 || b.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, c, d] = b;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && c >= 64 && c <= 127) ||            // CGNAT
    (a === 169 && c === 254) ||                      // link-local: cloud metadata
    (a === 172 && c >= 16 && c <= 31) ||
    (a === 192 && c === 0 && d === 0) ||
    (a === 192 && c === 0 && d === 2) ||
    (a === 192 && c === 168) ||
    (a === 198 && (c === 18 || c === 19)) ||
    (a === 198 && c === 51 && d === 100) ||
    (a === 203 && c === 0 && d === 113) ||
    a >= 224                                          // multicast and reserved
  );
}

/**
 * Resolve the hostname and refuse it if any address behind it is private.
 *
 * The lexical check in normalise() blocks "169.254.169.254" and "localhost".
 * It cannot block "169.254.169.254.nip.io", which is an ordinary public
 * hostname that resolves to the cloud metadata address — verified: it passed
 * the filter and the fetch was attempted against the metadata service.
 *
 * ALL resolved addresses have to be public, not just the first: a name that
 * answers with one public address and one private one is the same attack with
 * a coin flip in it.
 *
 * The residual is DNS rebinding — a name whose answer changes between this
 * lookup and the socket connecting. Closing that needs the connection pinned to
 * the address that was checked, which fetch() does not expose. Said plainly
 * rather than left to look complete: this raises the cost of the attack a great
 * deal and does not reduce it to zero.
 */
/** Read at most `cap` bytes of the body, then abandon the rest. */
async function readCapped(res: Response, cap: number): Promise<string> {
  const body = res.body;
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
      if (out.length >= cap) {
        out = out.slice(0, cap);
        break;
      }
    }
  } catch {
    /* A truncated read still gives us a title and a description. */
  } finally {
    await reader.cancel().catch(() => {});
  }
  return out;
}

async function publicOnly(hostname: string): Promise<boolean> {
  try {
    const { lookup } = await import("node:dns/promises");
    const answers = await lookup(hostname, { all: true });
    if (answers.length === 0) return false;
    return answers.every((a) => !privateAddress(a.address));
  } catch {
    return false;
  }
}

export function normalise(input: string): string | null {
  let u = input.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const p = new URL(u);
    if (p.protocol !== "https:" && p.protocol !== "http:") return null;
    /* No internal addresses. This fetches a URL a stranger supplied, so it must
       never be usable to probe the network the function runs in. */
    const h = p.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") ||
        h.endsWith(".local") || h.endsWith(".arpa") || h === "metadata.goog") return null;
    /* Literal addresses, v4 and v6. A hostname that RESOLVES to a private range
       is handled separately, by resolving it before the fetch — see
       publicOnly() below. This lexical pass stays because it is free and it
       catches the obvious half. */
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return null;
    if (h.includes(":")) return null;              // any IPv6 literal
    if (!h.includes(".")) return null;             // bare hostnames are internal
    return p.toString();
  } catch { return null; }
}

/**
 * Cached by URL, and this is the abuse mitigation.
 *
 * The page itself is force-dynamic — the URL is only known at request time —
 * and Next sends `no-store` for such routes, which overrode the Cache-Control
 * header set in next.config.ts. So the caching has to happen around the
 * expensive part instead: the outbound fetch of somebody else's page.
 *
 * With this, a second request for the same URL costs no outbound request at
 * all. What is still unbounded is walking thousands of DISTINCT URLs, which
 * needs shared state this site does not have — written down rather than
 * papered over with a per-instance counter, which is what day 1 shipped and it
 * did nothing under load.
 */
export const readProduct = (url: string) =>
  unstable_cache(() => fetchProduct(url), ["product", url], { revalidate: 3600 })();

async function fetchProduct(url: string): Promise<Read | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  let html = "";
  try {
    /* Redirects are followed BY HAND, and every hop goes back through
       normalise(). Following automatically meant the address bar check could be
       passed with a public hostname that then 302s to 169.254.169.254 — the
       block would have been decoration. Three hops is more than any real
       product page needs. */
    let target: string | null = url;
    let res: Response | null = null;
    for (let hop = 0; hop < 4 && target; hop++) {
      /* Resolved on EVERY hop, not only the first. A public host that redirects
         to a name pointing at the metadata service is the same attack wearing a
         302, and checking only the entry point would make this decoration. */
      if (!(await publicOnly(new URL(target).hostname))) return null;
      const r: Response = await fetch(target, {
        signal: ctl.signal,
        redirect: "manual",
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; intentthreads/1.0; +https://intentthreads.onedaybuilt.com)",
        },
      });
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.get("location");
        if (!loc) return null;
        target = normalise(new URL(loc, target).toString());
        if (!target) return null;      // redirected somewhere we will not go
        continue;
      }
      res = r;
      break;
    }
    if (!res || !res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;

    /* Read up to the cap and then STOP, rather than buffering everything and
       slicing afterwards.
     *
     * `(await res.text()).slice(0, 600_000)` bounded what got parsed and
     * bounded nothing else: a server answering with a gigabyte, or a gzip bomb
     * that expands to one, was pulled into the function's memory in full before
     * a single character was discarded. The cap described a limit it did not
     * enforce. Streaming makes it an actual limit — the connection is dropped
     * the moment enough has been read. */
    html = await readCapped(res, 600_000);
    if (!html) return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  const title = strip(pick(html, /<title[^>]*>([\s\S]{0,300}?)<\/title>/i));
  const desc = strip(metaContent(html, "description") || metaContent(html, "og:description"));
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
    /* What the product SAYS IT IS — title, description, first heading. Separate
       from the h2 feature list, because a feature is not an identity: PocketBase
       has an admin dashboard and Framer mentions analytics, and letting either
       word decide the subject made one a metrics tool and the other a log
       analyser. */
    key: [...new Set(strong)],
    /* The one line the product uses to say what it is. NOT the meta
       description, which ends in a feature list on every marketing page:
       PocketBase's finishes "and admin dashboard", Framer's "with hosting,
       security, analytics, CMS, and SEO built in", Typefully's "Grow faster
       with analytics". Reading the subject from there made a backend framework
       a metrics tool, a website builder a log analyser, and a social publishing
       tool an analytics product. */
    name: [...new Set(terms([title, h1].join(" ")))],
    weighted: [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([t]) => t),
  };
}

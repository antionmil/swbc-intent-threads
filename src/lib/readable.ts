/* Known HTML tags only. A GitHub issue body is markdown, and people also write
   sentences like "given a circle-ish thing you get a <circle> out" or
   "mbtop --replay <recording>". Stripping every <...> would eat those, so the
   list is closed and a bare <word> that is not on it stays exactly as written. */
const TAGS =
  "a|abbr|b|blockquote|br|code|del|details|div|em|h[1-6]|hr|i|img|input|ins|kbd|li|" +
  "ol|p|picture|pre|q|s|samp|source|span|strong|sub|summary|sup|table|tbody|td|th|" +
  "thead|tr|u|ul|var|video";

/**
 * Somebody's words, with the markup they were typed in taken off.
 *
 * The front page prints these sentences as prose, so a raw
 * `<img width="630" src="https://github.com/user-attachments/…" />` sitting in
 * the middle of one is not a small blemish — it is the row failing to read as a
 * person speaking. Display-time, not mine-time, because it has to fix the 1,931
 * rows already stored as well as everything the crons add next.
 */
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "\u2026", mdash: "\u2014", ndash: "\u2013", rsquo: "\u2019", lsquo: "\u2018",
  ldquo: "\u201c", rdquo: "\u201d",
};

/**
 * Turn `You&#39;re doing &#39;em wrong!` back into an apostrophe.
 *
 * YouTube hands video titles back HTML-escaped. Stored as-is and rendered by
 * React — which escapes the ampersand again — the reader sees the entity
 * itself. Decoding here rather than at render is deliberate: it runs BEFORE the
 * tag rules below, so a body that arrived with its markup escaped gets stripped
 * like any other instead of printing &lt;img …&gt; on the page. Nothing renders
 * these strings as HTML, so decoding cannot inject anything.
 */
export function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, g: string) => {
    const k = g.toLowerCase();
    if (k[0] !== "#") return ENTITIES[k] ?? m;
    const n = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    /* Surrogates and out-of-range code points make fromCodePoint throw. */
    if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return m;
    return String.fromCodePoint(n);
  });
}

export function readable(s: string): string {
  return decode(s)
    .replace(/<!--[\s\S]*?-->/g, " ")                       // html comments
    .replace(/```[\s\S]*?```/g, " ")                        // fenced code blocks
    .replace(/```/g, " ")                                   // an unclosed fence
    .replace(new RegExp(`</?(?:${TAGS})(?:\\s[^<>]*)?/?>`, "gi"), " ")
    /* An unterminated tag: the miner's cut landed inside the attributes, so
       there is no ">" for the rule above to find and the whole
       `<img width="228" height="364" alt` sat on the page. The first sweep for
       leftovers missed these too — it also required the closing bracket, so the
       check shared the blind spot of the fix and reported zero. */
    .replace(new RegExp(`<(?:${TAGS})\\b[^<>]*$`, "i"), " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")                  // markdown images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")                // links: keep the words
    /* An orphan: the miner's character limit cut the "[" off the front, leaving
       "…been added f](https://github.com/…)" with nothing for the rule above to
       pair against. Only when a URL follows, so ordinary prose is safe. */
    .replace(/\]\(\s*(?:https?:\/\/|www\.)[^)]*\)/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")                     // heading hashes
    /* The miner flattens newlines before storing, so a heading ends up mid
       sentence: "…margins). ### How to make it happen". Two or more hashes is
       unambiguous — a single one is left alone so "issue #391" survives. */
    .replace(/\s#{2,6}\s+/g, " ")
    .replace(/^\s{0,3}>\s?/gm, "")                          // block quotes
    .replace(/(\*\*|__)(.+?)\1/g, "$2")                     // bold
    .replace(/(^|\W)[*_]([^*_\n]+)[*_](\W|$)/g, "$1$2$3")   // italics
    .replace(/^\s*[-*+]\s+/gm, "")                          // list bullets
    .replace(/^\s*[-*_]{3,}\s*$/gm, " ")                    // horizontal rules
    /* Flattened newlines leave a rule stranded mid-sentence. Markdown also
       reads "---" as an em dash, so print one rather than delete the author's
       punctuation — either way it stops looking like a broken page. */
    .replace(/\s-{3,}\s/g, " — ")
    /* Delimiters the miner's cut orphaned: a comment whose "-->" never arrived
       runs to the end of the text by definition, and a lone "**" is a marker
       with nothing left to mark. Both are noise either way. */
    .replace(/<!--[\s\S]*$/, " ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    /* A sentence that ends "amazing to have : -" is a list whose items the cut
       took away. No English sentence ends on a dangling colon or dash, so this
       is always damage, whatever its length.
       ONE character class and ONE quantifier, deliberately: the first draft was
       /(?:\s*[-–—:;,]+)+$/, a nested quantifier, and it backtracked
       catastrophically — four node processes at 100% CPU and a build that never
       returned. Every lead is somebody else's text, so a regex that can hang on
       an input is not a performance note, it is the server. */
    .replace(/[\s,;:–—-]+$/, (m) => (/[,;:–—-]/.test(m) ? "…" : ""));
}

/* The miners store 300 (YouTube) or 320 (GitHub, Hacker News) characters, and
   the cut lands wherever it lands — "I haven't found it yet. sinc". Nothing
   downstream can recover the rest, so the least the page can do is end on a
   whole word and admit that it stopped. */
const CUT = 290;

/** `readable`, then ended honestly if a miner had already cut it short. */
export function clipped(s: string): string {
  const t = readable(s);
  /* Measured on the RAW string: stripping markdown shortens it, so a body the
     miner truncated at 320 can arrive here under the threshold and keep its
     half-word. The cut happened before this function ever saw the text. */
  if (s.length < CUT) return t;
  const w = t.replace(/\s+\S*$/, "");
  /* Already ends on a full stop: the halved word was the only damage. */
  if (/[.!?]["')\]]?$/.test(w)) return w;
  return w.replace(/[\s,;:–—-]+$/, "") + "…";
}

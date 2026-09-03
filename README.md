# Intent threads

> Paste your product. Find the strangers who already asked for it in public,
> and where to go and say hello.

Day 3 of a 26-day [one-website-a-day run](https://onedaybuilt.com).

## What it is

Every row is one person, in public, saying they wanted something that did not
exist for them yet — mined from Hacker News comments and GitHub issue bodies.
Their words, their name, their link. You paste a product URL; the site reads
what that page says it does and ranks the corpus against it.

## Three decisions worth writing down

- **No database.** The corpus is identical for every visitor, so it ships as a
  static artifact and the search runs in memory. Neon scales to zero after five
  minutes idle and a cold query would have been the slowest thing on the page.

- **No model in the request path.** A product page states what it does in its
  title, meta description and first heading — that is what those elements are
  for. Reading them is free, instant, and cannot invent a description of
  somebody's business.

- **The badge is evidence, not a verdict.** An earlier build labelled rows
  "exact match". Tested against real products that was right about half the
  time, so it was lying to every other reader. Each row now shows the rare word
  the two pages share — `analytics`, `bookmarks` — which is a fact the reader
  can check in one glance.

## Sources, and the ones rejected

| source | status |
|---|---|
| GitHub issue bodies | ~50k matches on three phrases, dated to today, every asker reachable |
| Hacker News comments | fewer, but whole-product asks rather than in-repo feature requests |
| Reddit | **rejected** — public JSON returns 403 unauthenticated; free tier is non-commercial and needs pre-approval |
| 4chan | **rejected** — 1% of posters have a name, so there is nobody to write to |
| Stack Overflow | **rejected** — closes tool-recommendation questions by policy |
| Software Recommendations SE | **rejected** — 617 of its 800 questions are from 2014; dead since 2016 |

## Ranking, in one paragraph

Term overlap weighted by inverse document frequency, where only the three
rarest shared words count. In this corpus `tool` carries an IDF of 1.26 and
`analytics` carries 5.83, so breadth of shared vocabulary is mostly noise and
rarity is the whole signal. Query terms are filtered to words the corpus has
actually seen — sorting by IDF alone promoted `cookieless` and `self-hostable`,
which score highest and can never match anything.

## Running it

```bash
pnpm install
pnpm dev
```

`prep/mine_github.py` fills `prep/corpus_github.jsonl`; `prep/build_corpus.py`
turns that plus the Hacker News rows into `src/data/corpus.json`.
`GITHUB_TOKEN` is optional and only raises the search API from 10 to 30
requests a minute.

import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
const env = fs.readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sql = neon(process.env.DATABASE_URL);

// counts + url shape census
const shapes = await sql`
  select src,
         count(*) as n,
         count(*) filter (where url like '%#issuecomment-%') as gh_comment_anchor,
         count(*) filter (where url like '%#discussioncomment-%') as gh_disc_anchor,
         count(*) filter (where url like '%/pull/%') as gh_pull,
         count(*) filter (where url like '%/issues/%') as gh_issue,
         count(*) filter (where url like '%lc=%') as yt_lc,
         count(*) filter (where url like '%item?id=%') as hn_item,
         count(*) filter (where url !~ '^https://') as not_https
    from leads group by src order by src`;
console.log("SHAPES", JSON.stringify(shapes, null, 1));

const rnd = await sql`
  select src, id, who, repo, ctx, url, left(wish, 120) as wish, asked_on
    from leads
   where src='github' order by random() limit 12`;
const hn = await sql`
  select src, id, who, repo, ctx, url, left(wish,120) as wish, asked_on
    from leads where src='hn' order by random() limit 10`;
const yt = await sql`
  select src, id, who, repo, ctx, url, left(wish,120) as wish, asked_on
    from leads where src='youtube' order by random() limit 10`;
fs.writeFileSync("/private/tmp/claude-501/-Users-antoinekoerber-Programming-SWBC---September-Website-Building-Challenge/e1404fda-06ec-4f7c-9606-edf91413cfa9/scratchpad/sample.json", JSON.stringify([...rnd, ...hn, ...yt], null, 1));
console.log("wrote", rnd.length + hn.length + yt.length);

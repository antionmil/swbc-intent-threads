import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select id, src, who, url, wish from leads`;
// "I built / I made / so I created ... check it out" = the author shipped it
const BUILT = /\b(so i (built|made|created|wrote)|i (built|made|created) (this|it|a|an|my)|i(?:'ve| have) (built|made|created)|i decided to build|that'?s why i built|check it out|try it (here|at)|feedback (is )?(welcome|appreciated)|i'?m the (author|creator|founder|dev)|launched (it|today)|introducing my)\b/i;
const hits = rows.filter(r=>BUILT.test(r.wish));
const by = hits.reduce((a,r)=>(a[r.src]=(a[r.src]||0)+1,a),{});
console.log("leads whose own quoted words say the person BUILT the thing:", hits.length, "of", rows.length, JSON.stringify(by));
for(const h of hits.slice(0,18)) console.log(" ", h.src.padEnd(7), h.url.padEnd(58), "|", h.who.padEnd(18), "|", h.wish.replace(/\s+/g," ").slice(0,95));

import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select id, who, url, wish from leads where src='hn'`;
const norm = s => (s||"").toLowerCase().replace(/&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/<[^>]*>/g," ").replace(/[^a-z0-9]+/g," ").trim();
const out = [];
let i = 0;
async function worker() {
  while (i < rows.length) {
    const r = rows[i++];
    const id = (r.url.match(/id=(\d+)/)||[])[1];
    if (!id) { out.push({...r, verdict:"no-id"}); continue; }
    let d = null;
    for (let t=0;t<3;t++){ try { const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`); if(res.ok){ d = await res.json(); break; } } catch {} await new Promise(z=>setTimeout(z,300*(t+1))); }
    if (d === null) { out.push({...r, verdict:"fetch-failed"}); continue; }
    if (d === undefined || d === null) { out.push({...r, verdict:"item-null"}); continue; }
    const w = norm(r.wish).slice(0, 60);
    const body = norm(d.text || d.title || "");
    out.push({ id: r.id, who: r.who, url: r.url, type: d.type ?? "MISSING",
      by: d.by ?? null, dead: !!d.dead, deleted: !!d.deleted,
      byMatch: (d.by||"").toLowerCase() === (r.who||"").toLowerCase(),
      textMatch: body.includes(w), wishHead: r.wish.slice(0,60) });
  }
}
await Promise.all(Array.from({length:8}, worker));
fs.writeFileSync("/private/tmp/claude-501/-Users-antoinekoerber-Programming-SWBC---September-Website-Building-Challenge/e1404fda-06ec-4f7c-9606-edf91413cfa9/scratchpad/hn.json", JSON.stringify(out,null,1));
const c = (f) => out.filter(f).length;
console.log("total", out.length);
console.log("types", JSON.stringify(out.reduce((a,o)=>(a[o.type]=(a[o.type]||0)+1,a),{})));
console.log("null/missing items:", c(o=>o.verdict==="item-null"||o.type==="MISSING"), " fetch-failed:", c(o=>o.verdict==="fetch-failed"));
console.log("dead:", c(o=>o.dead), "deleted:", c(o=>o.deleted));
console.log("byMatch true:", c(o=>o.byMatch), " false:", c(o=>o.byMatch===false));
console.log("textMatch true:", c(o=>o.textMatch), " false:", c(o=>o.textMatch===false));

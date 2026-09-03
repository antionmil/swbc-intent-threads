import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const SP="/private/tmp/claude-501/-Users-antoinekoerber-Programming-SWBC---September-Website-Building-Challenge/e1404fda-06ec-4f7c-9606-edf91413cfa9/scratchpad";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select id, who, ctx, url, to_char(asked_on,'YYYY-MM-DD') as d, left(wish,80) as wish from leads where src='youtube' order by id`;
const UA={"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36","accept-language":"en-US,en;q=0.9"};
const out=[]; let i=0;
async function worker(){
  while(i<rows.length){
    const r=rows[i++];
    let t=null, st=0;
    for(let a=0;a<3;a++){
      try{ const res=await fetch(r.url,{headers:UA}); st=res.status; const h=await res.text();
        t=(h.match(/<title>([^<]{0,160})<\/title>/)||[])[1] ?? null;
        if(t) break;
      }catch{}
      await new Promise(z=>setTimeout(z,800*(a+1)));
    }
    const m=(t||"").match(/^Comment from @(.+?) - YouTube$/);
    const author=m?m[1]:null;
    out.push({id:r.id, who:r.who, url:r.url, status:st, title:t, lcResolved:!!author, author,
      authorMatch: author ? author.toLowerCase()===String(r.who).toLowerCase() : null, wish:r.wish});
    await new Promise(z=>setTimeout(z,120));
  }
}
await Promise.all(Array.from({length:4},worker));
fs.writeFileSync(SP+"/yt_lc.json", JSON.stringify(out,null,1));
const c=f=>out.filter(f).length;
console.log("total", out.length);
console.log("lc RESOLVED:", c(o=>o.lcResolved), " lc IGNORED (dumped at video):", c(o=>!o.lcResolved));
console.log("authorMatch t/f:", c(o=>o.authorMatch===true), c(o=>o.authorMatch===false));
console.log("http non-200:", c(o=>o.status!==200));
console.log("--- failures ---");
for(const f of out.filter(o=>!o.lcResolved).slice(0,25)) console.log(f.status, f.url, "|", f.who, "|", (f.title||"").slice(0,70));
console.log("--- author mismatches ---");
for(const f of out.filter(o=>o.authorMatch===false).slice(0,15)) console.log(f.url,"| stored:",f.who,"| actual:",f.author);

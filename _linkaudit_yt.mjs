import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const SP="/private/tmp/claude-501/-Users-antoinekoerber-Programming-SWBC---September-Website-Building-Challenge/e1404fda-06ec-4f7c-9606-edf91413cfa9/scratchpad";
const KEY=process.env.YOUTUBE_API_KEY;
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select id, who, ctx, url, wish from leads where src='youtube' order by id`;
const parsed = rows.map(r=>{
  const u=new URL(r.url); return {...r, v:u.searchParams.get("v"), lc:u.searchParams.get("lc")};
});
console.log("total", parsed.length, " missing v:", parsed.filter(p=>!p.v).length, " missing lc:", parsed.filter(p=>!p.lc).length);
console.log("lc contains '.' (reply id):", parsed.filter(p=>p.lc?.includes(".")).length);

const dec = s => (s||"").replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(+d)).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const norm = s => dec(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

// comments.list accepts up to 50 comma-separated ids
const found = new Map();
for(let i=0;i<parsed.length;i+=50){
  const ids = parsed.slice(i,i+50).map(p=>p.lc).join(",");
  const r = await fetch(`https://www.googleapis.com/youtube/v3/comments?part=snippet&id=${encodeURIComponent(ids)}&textFormat=plainText&key=${KEY}`);
  const d = await r.json();
  if(d.error){ console.log("API error", JSON.stringify(d.error).slice(0,300)); }
  for(const it of d.items??[]) found.set(it.id, it);
}
// video liveness in one shot
const vids=[...new Set(parsed.map(p=>p.v))];
const liveVid=new Set(); const vidStatus=new Map();
for(let i=0;i<vids.length;i+=50){
  const r=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${vids.slice(i,i+50).join(",")}&key=${KEY}`);
  const d=await r.json();
  for(const it of d.items??[]){ liveVid.add(it.id); vidStatus.set(it.id,{embeddable:it.status?.embeddable, privacy:it.status?.privacyStatus, title:it.snippet?.title}); }
}
const out = parsed.map(p=>{
  const c = found.get(p.lc);
  return { id:p.id, who:p.who, url:p.url, v:p.v, lc:p.lc,
    commentExists: !!c,
    parentVideo: c?.snippet?.videoId ?? null,
    videoMatch: c ? c.snippet.videoId === p.v : null,
    authorMatch: c ? (c.snippet.authorDisplayName||"").replace(/^@/,"").toLowerCase() === (p.who||"").toLowerCase() : null,
    textMatch: c ? norm(c.snippet.textDisplay||"").includes(norm(p.wish).slice(0,45)) : null,
    videoLive: liveVid.has(p.v), videoPrivacy: vidStatus.get(p.v)?.privacy ?? "GONE",
    wishHead:p.wish.slice(0,60) };
});
fs.writeFileSync(SP+"/yt.json", JSON.stringify(out,null,1));
const c=f=>out.filter(f).length;
console.log("commentExists:", c(o=>o.commentExists), "/", out.length);
console.log("videoMatch t/f:", c(o=>o.videoMatch===true), c(o=>o.videoMatch===false));
console.log("authorMatch t/f:", c(o=>o.authorMatch===true), c(o=>o.authorMatch===false));
console.log("textMatch t/f:", c(o=>o.textMatch===true), c(o=>o.textMatch===false));
console.log("videoLive:", c(o=>o.videoLive), " gone:", c(o=>!o.videoLive));
console.log("privacy:", JSON.stringify(out.reduce((a,o)=>(a[o.videoPrivacy]=(a[o.videoPrivacy]||0)+1,a),{})));

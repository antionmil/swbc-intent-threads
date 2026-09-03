import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const SP="/private/tmp/claude-501/-Users-antoinekoerber-Programming-SWBC---September-Website-Building-Challenge/e1404fda-06ec-4f7c-9606-edf91413cfa9/scratchpad";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`select id, who, ctx, url, to_char(asked_on,'YYYY-MM-DD') as d from leads where src='youtube'`;
const vids=[...new Set(rows.map(r=>new URL(r.url).searchParams.get("v")))];
console.log("distinct videos:", vids.length, "for", rows.length, "leads");
const res=new Map(); let i=0;
async function worker(){
  while(i<vids.length){
    const v=vids[i++];
    let st=0, title=null;
    try{
      const r=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v="+v)}&format=json`);
      st=r.status; if(r.ok){ const d=await r.json(); title=d.title; }
    }catch(e){ st=-1; }
    res.set(v,{st,title});
  }
}
await Promise.all(Array.from({length:6},worker));
const bad=[...res].filter(([v,o])=>o.st!==200);
console.log("oembed status counts:", JSON.stringify([...res.values()].reduce((a,o)=>(a[o.st]=(a[o.st]||0)+1,a),{})));
console.log("dead videos:", bad.length, JSON.stringify(bad.slice(0,20)));
// ctx vs live title mismatch
const dec = s => (s||"").replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(+d)).replace(/&amp;/g,"&").replace(/&quot;/g,'"');
const norm=s=>dec(s).toLowerCase().replace(/[^a-z0-9]+/g,"").trim();
let mm=0, ex=[];
for(const r of rows){
  const v=new URL(r.url).searchParams.get("v"); const o=res.get(v); if(o?.st!==200) continue;
  const a=norm(r.ctx).slice(0,60), b=norm(o.title).slice(0,60);
  if(!b.startsWith(a.slice(0,Math.min(a.length,55))) && !norm(o.title).includes(a.slice(0,40))) { mm++; if(ex.length<8) ex.push({ctx:r.ctx, live:o.title, url:r.url}); }
}
console.log("ctx != live video title:", mm, "of", rows.length);
console.log(JSON.stringify(ex,null,1));
const deadLeads = rows.filter(r=>res.get(new URL(r.url).searchParams.get("v"))?.st!==200);
fs.writeFileSync(SP+"/yt_dead.json", JSON.stringify(deadLeads,null,1));
console.log("leads pointing at a dead video:", deadLeads.length);

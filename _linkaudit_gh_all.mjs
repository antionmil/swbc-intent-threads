import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const SP="/private/tmp/claude-501/-Users-antoinekoerber-Programming-SWBC---September-Website-Building-Challenge/e1404fda-06ec-4f7c-9606-edf91413cfa9/scratchpad";
const sql = neon(process.env.DATABASE_URL);
const all = await sql`select id, who, repo, url, wish from leads where src='github' order by id`;
// deterministic spread: every Nth row, 200 of 1244
const N = all.length, step = 1;
const rows = Array.from({length:N},(_,i)=>all[Math.floor(i*step)]);
const H = { accept:"application/vnd.github+json", "user-agent":"linkaudit", authorization:`Bearer ${process.env.GITHUB_TOKEN}` };
const dec = s => (s||"").replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(+d)).replace(/&amp;/g,"&").replace(/&quot;/g,'"');
const norm = s => dec(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const out=[]; let i=0;
async function worker(){
  while(i<rows.length){
    const r=rows[i++];
    const m = r.url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if(!m){ out.push({...r, verdict:"unparseable"}); continue; }
    const [,o,rep,num]=m;
    let res=null, body=null;
    for(let t=0;t<3;t++){
      try{ res = await fetch(`https://api.github.com/repos/${o}/${rep}/issues/${num}`,{headers:H});
        if(res.status===403||res.status===429){ await new Promise(z=>setTimeout(z,3000*(t+1))); continue; }
        body = res.status===200 ? await res.json() : null; break;
      }catch{ await new Promise(z=>setTimeout(z,1000*(t+1))); }
    }
    const status = res?.status ?? 0;
    let textMatch=null, authorMatch=null, isPR=false, htmlUrl=null, repoMatch=null;
    if(status===200 && body){
      isPR = !!body.pull_request; htmlUrl = body.html_url;
      authorMatch = (body.user?.login||"").toLowerCase() === (r.who||"").toLowerCase();
      const w = norm(r.wish).slice(0,55);
      textMatch = norm(body.body||"").includes(w);
      repoMatch = (`${o}/${rep}`).toLowerCase() === (r.repo||"").toLowerCase();
    }
    out.push({id:r.id, who:r.who, repo:r.repo, url:r.url, status, isPR, htmlUrl, authorMatch, textMatch, repoMatch, wishHead:r.wish.slice(0,70)});
  }
}
await Promise.all(Array.from({length:8},worker));
fs.writeFileSync(SP+"/gh_all.json", JSON.stringify(out,null,1));
const c=f=>out.filter(f).length;
console.log("sampled", out.length, "of", all.length);
console.log("status counts", JSON.stringify(out.reduce((a,o)=>(a[o.status]=(a[o.status]||0)+1,a),{})));
console.log("isPR:", c(o=>o.isPR));
console.log("authorMatch true/false:", c(o=>o.authorMatch===true), c(o=>o.authorMatch===false));
console.log("textMatch  true/false:", c(o=>o.textMatch===true), c(o=>o.textMatch===false));
console.log("repoMatch  true/false:", c(o=>o.repoMatch===true), c(o=>o.repoMatch===false));
console.log("redirected (htmlUrl != url):", c(o=>o.htmlUrl && o.htmlUrl!==o.url));

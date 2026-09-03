import fs from "node:fs";
const html = fs.readFileSync("/tmp/find.html","utf8");
const urls=[...new Set([...html.matchAll(/<a href="(https:\/\/[^"]+)" target="_blank" rel="noopener nofollow"/g)].map(m=>m[1].replace(/&amp;/g,"&")))];
console.log("reply links on the /find result page:", urls.length);
console.log("by host:", JSON.stringify(urls.reduce((a,u)=>{const h=new URL(u).host;a[h]=(a[h]||0)+1;return a;},{})));
const UA={"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36","accept-language":"en-US,en;q=0.9"};
for(const u of urls){
  let verdict="?";
  if(u.includes("youtube.com")){
    const h=await (await fetch(u,{headers:UA})).text();
    const t=(h.match(/<title>([^<]{0,160})<\/title>/)||[])[1]||"";
    verdict = /^Comment from @/.test(t) ? "OK comment: "+t.replace(" - YouTube","") : "LC IGNORED -> "+t.slice(0,50);
  } else if(u.includes("news.ycombinator.com")){
    const id=u.match(/id=(\d+)/)[1];
    const d=await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json();
    verdict = d ? `OK ${d.type} by ${d.by}${d.dead?" DEAD":""}${d.deleted?" DELETED":""}` : "ITEM MISSING";
  } else {
    const r=await fetch(u,{method:"GET",headers:UA,redirect:"manual"});
    verdict = `HTTP ${r.status}${r.headers.get("location")?" -> "+r.headers.get("location"):""}`;
  }
  console.log(verdict.padEnd(46), u);
  await new Promise(r=>setTimeout(r,150));
}

import fs from "node:fs";
const SP="/private/tmp/claude-501/-Users-antoinekoerber-Programming-SWBC---September-Website-Building-Challenge/e1404fda-06ec-4f7c-9606-edf91413cfa9/scratchpad";
const prev = JSON.parse(fs.readFileSync(SP+"/hn.json","utf8"));
const bad = prev.filter(x=>x.textMatch===false);
const dec = s => (s||"").replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCodePoint(parseInt(h,16)))
                        .replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(+d))
                        .replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">");
const norm = s => dec(s).toLowerCase().replace(/<[^>]*>/g," ").replace(/[^a-z0-9]+/g," ").trim();
const still=[];
for (const b of bad) {
  const id=(b.url.match(/id=(\d+)/)||[])[1];
  const d = await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json();
  const body = norm(d.text||d.title||"");
  const w = norm(b.wishHead).slice(0,50);
  if (!body.includes(w)) still.push({url:b.url, type:b.type, who:b.who, wish:b.wishHead, bodyHead:(dec(d.text||d.title||"")).replace(/<[^>]*>/g," ").slice(0,220)});
  await new Promise(r=>setTimeout(r,80));
}
console.log("still mismatched:", still.length, "of", bad.length);
console.log(JSON.stringify(still,null,1));

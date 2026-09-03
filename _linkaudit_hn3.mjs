import fs from "node:fs";
const SP="/private/tmp/claude-501/-Users-antoinekoerber-Programming-SWBC---September-Website-Building-Challenge/e1404fda-06ec-4f7c-9606-edf91413cfa9/scratchpad";
const all = JSON.parse(fs.readFileSync(SP+"/hn.json","utf8"));
const stories = all.filter(x=>x.type==="story");
const dec = s => (s||"").replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(m,d)=>String.fromCodePoint(+d)).replace(/&amp;/g,"&").replace(/&quot;/g,'"');
const norm=s=>dec(s).toLowerCase().replace(/<[^>]*>/g," ").replace(/[^a-z0-9]+/g," ").trim();
const out=[];
for(const s of stories){
  const id=s.url.match(/id=(\d+)/)[1];
  const d=await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json();
  const w=norm(s.wishHead).slice(0,45);
  out.push({url:s.url, who:s.who, title:d.title, hasText:!!d.text,
    quoteInTitle: norm(d.title||"").includes(w), quoteInText: norm(d.text||"").includes(w),
    kind: /^show hn/i.test(d.title||"") ? "ShowHN" : /^ask hn/i.test(d.title||"") ? "AskHN" : /^tell hn/i.test(d.title||"") ? "TellHN" : "link",
    wish:s.wishHead});
  await new Promise(r=>setTimeout(r,60));
}
fs.writeFileSync(SP+"/hn_stories.json", JSON.stringify(out,null,1));
const c=f=>out.filter(f).length;
console.log("story-type leads:", out.length, "of 540 =", (100*out.length/540).toFixed(1)+"%");
console.log("kinds:", JSON.stringify(out.reduce((a,o)=>(a[o.kind]=(a[o.kind]||0)+1,a),{})));
console.log("quote came from the story TITLE:", c(o=>o.quoteInTitle&&!o.quoteInText));
console.log("quote came from the story TEXT :", c(o=>o.quoteInText));
console.log("--- Show HN (person BUILT it, presented as wanting it) ---");
for(const o of out.filter(o=>o.kind==="ShowHN")) console.log(" ", o.url,"|",o.who,"|",o.title.slice(0,70),"|| wish:",o.wish.slice(0,60));
console.log("--- plain external link submissions (words are the submitter's? ) ---");
for(const o of out.filter(o=>o.kind==="link").slice(0,10)) console.log(" ", o.url,"|",o.who,"|",o.title.slice(0,60),"| inTitle:",o.quoteInTitle,"inText:",o.quoteInText);

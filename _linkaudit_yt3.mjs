const ids=["rQFLL2u_QvA","08IrZCz2W64","8RYQj1TKyPU","0Uh4iBr6OLo"]; // last is a known-good control
for(const v of ids){
  const r=await fetch(`https://www.youtube.com/watch?v=${v}`,{headers:{"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36","accept-language":"en-US,en;q=0.9"}});
  const h=await r.text();
  const st=(h.match(/"playabilityStatus":\{"status":"([A-Z_]+)"/)||[])[1];
  const reason=(h.match(/"playabilityStatus":\{"status":"[A-Z_]+","reason":"([^"]{0,120})"/)||[])[1];
  const title=(h.match(/<meta name="title" content="([^"]{0,90})"/)||[])[1];
  console.log(v, "http="+r.status, "playability="+st, "reason="+(reason??"-"), "title="+(title??"-"));
}

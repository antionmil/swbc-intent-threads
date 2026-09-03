const UA={"user-agent":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36","accept-language":"en-US,en;q=0.9"};
const cases=[
 ["good",  "https://www.youtube.com/watch?v=08IrZCz2W64&lc=Ugw1o14wWnMzKbQNdO14AaABAg","sheel101"],
 ["nolc",  "https://www.youtube.com/watch?v=08IrZCz2W64",null],
 ["bogus", "https://www.youtube.com/watch?v=08IrZCz2W64&lc=UgxNOTAREALCOMMENTIDzzzz4AaABAg",null],
 ["mismatch","https://www.youtube.com/watch?v=0Uh4iBr6OLo&lc=Ugw1o14wWnMzKbQNdO14AaABAg",null],
];
for(const [k,u,expect] of cases){
  const r=await fetch(u,{headers:UA}); const h=await r.text();
  const t=(h.match(/<title>([^<]{0,120})<\/title>/)||[])[1];
  const og=(h.match(/<meta property="og:title" content="([^"]{0,120})"/)||[])[1];
  const desc=(h.match(/<meta name="description" content="([^"]{0,140})"/)||[])[1];
  console.log(k.padEnd(9), "http="+r.status, "| title:", t, "| og:", og);
}

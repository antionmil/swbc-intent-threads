import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const sql = neon(process.env.DATABASE_URL);
// one lead per distinct video, oldest-first spread + the three embed-restricted ones
const rows = await sql`
  select distinct on (split_part(split_part(url,'v=',2),'&',1))
         who, url, to_char(asked_on,'YYYY-MM-DD') as d, left(wish,70) as wish
    from leads where src='youtube'
   order by split_part(split_part(url,'v=',2),'&',1), asked_on asc`;
const pick = [];
const forced = rows.filter(r=>/rQFLL2u_QvA|08IrZCz2W64|8RYQj1TKyPU/.test(r.url));
const rest = rows.filter(r=>!forced.includes(r)).sort((a,b)=>a.d.localeCompare(b.d));
pick.push(...forced, rest[0], rest[1], rest[Math.floor(rest.length/3)], rest[Math.floor(rest.length/2)], rest[Math.floor(rest.length*2/3)], rest[rest.length-2], rest[rest.length-1]);
console.log(JSON.stringify(pick,null,1));

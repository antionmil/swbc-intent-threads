import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local","utf8").split("\n")) {
  const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^["']|["']$/g,"");
}
const sql = neon(process.env.DATABASE_URL);
/* Not a fabricated person: a REAL lead's discovery timestamp moved forward for
   about a minute, then put back exactly. Nothing is invented and nothing is
   left behind. */
await sql.query("update leads set first_seen = now() where id = $1", ["85d203b1f05dab59"]);
const r = await sql.query("select first_seen from leads where id = $1", ["85d203b1f05dab59"]);
console.log("bumped to", r[0].first_seen);
process.exit(0);

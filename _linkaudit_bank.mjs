import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
}
const html = fs.readFileSync("/tmp/bank.html","utf8");
const urls = [...html.matchAll(/<a href="(https:\/\/[^"]+)" target="_blank" rel="noopener nofollow"/g)].map(m=>m[1].replace(/&amp;/g,"&"));
console.log("outbound reply links on /bank:", urls.length);
console.log("unique:", new Set(urls).size);
const byHost = urls.reduce((a,u)=>{const h=new URL(u).host; a[h]=(a[h]||0)+1; return a;},{});
console.log("by host:", JSON.stringify(byHost));
const sql = neon(process.env.DATABASE_URL);
const known = new Set((await sql`select url from leads`).map(r=>r.url));
const unknown = urls.filter(u=>!known.has(u));
console.log("links on the page NOT in the leads table:", unknown.length, unknown.slice(0,5));
// the removal link
const rm = [...html.matchAll(/href="(https:\/\/github\.com\/antionmil[^"]*)"/g)].map(m=>m[1]);
console.log("removal link on /bank:", JSON.stringify(rm.slice(0,2)));

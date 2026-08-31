import { checkGate } from "../src/lib/ratelimit";
const req = (ip: string) => new Request("http://x", { headers: { "x-forwarded-for": ip } });
const label = (g: Awaited<ReturnType<typeof checkGate>>) =>
  g.ok ? "allowed" : `BLOCKED (${g.reason})`;

console.log(`per-IP limit = ${process.env.IP_DAILY_LIMIT}, ceiling = ${process.env.DAILY_GENERATION_CEILING}`);
for (let i = 1; i <= 5; i++) console.log(`  same IP, call ${i}: ${label(await checkGate(req("1.2.3.4")))}`);
console.log(`  a different IP  : ${label(await checkGate(req("9.9.9.9")))}  <- limit is per IP`);

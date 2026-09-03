// READ-ONLY / NO REAL DB. Fabricated connection strings only.
// Question: what does e.message contain for the failure modes the finding names?
import { neon } from "@neondatabase/serverless";

const show = (label, e) => {
  const m = e instanceof Error ? e.message.slice(0, 200) : String(e);
  console.log(`\n### ${label}`);
  console.log("  ctor      :", e?.constructor?.name);
  console.log("  .message  :", JSON.stringify(m));
  console.log("  leaks pwd?:", /sup3rs3cr3t/.test(m));
  console.log("  leaks host?:", /ep-fake-endpoint-12345/.test(m));
  console.log("  leaks role?:", /neondb_owner_fake/.test(m));
};

const FAKE = "postgresql://neondb_owner_fake:sup3rs3cr3t@ep-fake-endpoint-12345.eu-central-1.aws.neon.tech/neondb?sslmode=require";

// A) connection-time failure: valid-shaped string, host does not exist
try {
  const s = neon(FAKE);
  await s`select 1`;
  console.log("A) unexpectedly succeeded");
} catch (e) { show("A) connection-time failure (host does not resolve)", e); }

// B) malformed connection string handed to neon()
try {
  const s = neon("not-a-url-at-all-sup3rs3cr3t");
  await s`select 1`;
} catch (e) { show("B) malformed connection string passed to neon()", e); }

// C) what db.ts throws when nothing is configured (mirrors src/lib/db.ts:33)
try { throw new Error("no connection string configured"); }
catch (e) { show("C) db.ts no-connection-string branch", e); }

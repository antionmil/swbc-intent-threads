import { pgTable, text, integer, timestamp, jsonb, index, serial, boolean } from "drizzle-orm/pg-core";

/** Public, unauthenticated submissions. Four ideas need this; none needs accounts. */
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),                       // per-site discriminator
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  ip_hash: text("ip_hash"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("submissions_status_idx").on(t.status, t.created_at)]);

/** getOrCompute backing store. Postgres, not Redis - one fewer service to
 *  provision 26 times. */
export const cache = pgTable("cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("cache_expiry_idx").on(t.expires_at)]);

/** Rate-limit counters.
 *  `bucket` is the PRIMARY KEY, not a plain column. That is load-bearing:
 *  the counter is a single atomic INSERT .. ON CONFLICT DO UPDATE, and
 *  without the uniqueness there is no conflict to catch, every call inserts
 *  a fresh row, every count comes back as 1, and BOTH the per-IP limit and
 *  the global daily ceiling silently never fire. */
export const events = pgTable("events", {
  bucket: text("bucket").primaryKey(),  // "gen:2026-09-01" or "gen:2026-09-01:<ip_hash>"
  n: integer("n").notNull().default(0),
  day: text("day").notNull(),           // YYYY-MM-DD, for cheap cleanup
}, (t) => [index("events_day_idx").on(t.day)]);

/** Stored results so /r/[id] can be shared with no auth anywhere in the system. */
export const results = pgTable("results", {
  id: text("id").primaryKey(),        // short random id, url-safe
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  stat: text("stat"),
  subtitle: text("subtitle"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  public: boolean("public").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

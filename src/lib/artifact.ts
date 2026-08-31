import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * The static-artifact write path.
 *
 * Neon's free plan scales computes to zero after 5 minutes idle and that
 * CANNOT be disabled. A site that sits quiet and then spikes from one tweet
 * would make its first visitor wait on a cold Postgres. So anything
 * precomputed is written to a JSON artifact at cron time and read from disk
 * or the CDN on the request path. The database is for writes and submissions,
 * never for a read a visitor is waiting on.
 */
const DIR = path.join(process.cwd(), "public", "artifacts");

export async function writeArtifact(name: string, data: unknown) {
  await fs.mkdir(DIR, { recursive: true });
  const body = JSON.stringify({ generated_at: new Date().toISOString(), data });
  await fs.writeFile(path.join(DIR, `${name}.json`), body, "utf8");
  return `/artifacts/${name}.json`;
}

export async function readArtifact<T>(
  name: string,
): Promise<{ generated_at: string; data: T } | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}

/** Short, url-safe id for /r/[id]. No ambiguous characters. */
export function shortId(len = 10) {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes)
    .map((x) => alphabet[x % alphabet.length])
    .join("");
}

import { desc } from "drizzle-orm";
import { db, hasDb, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Not auth - a moderation queue behind one env var. For week one you can
 *  also just run SQL. Do not build user accounts for this. */
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  const pass = process.env.ADMIN_PASSWORD;

  if (!pass || k !== pass) {
    return (
      <main className="mx-auto max-w-md px-5 py-24">
        <p className="text-muted">Append <code>?k=</code> and the admin password.</p>
      </main>
    );
  }
  if (!hasDb()) {
    return <main className="mx-auto max-w-md px-5 py-24"><p className="text-muted">No database configured.</p></main>;
  }

  const rows = await db().select().from(schema.submissions)
    .orderBy(desc(schema.submissions.created_at)).limit(100);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-16">
      <h1 className="font-display text-2xl font-bold">Moderation queue</h1>
      <p className="text-muted">{rows.length} most recent submissions.</p>
      <div className="overflow-x-auto rounded-lg border border-rule">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted">
            <tr><th className="p-3">id</th><th className="p-3">kind</th><th className="p-3">status</th><th className="p-3">payload</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-rule align-top">
                <td className="p-3">{r.id}</td>
                <td className="p-3">{r.kind}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3"><pre className="max-w-md overflow-x-auto text-xs">{JSON.stringify(r.payload)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

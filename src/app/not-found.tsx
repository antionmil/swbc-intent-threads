import Link from "next/link";

/* Next's stock 404 is client-rendered, ships its own black-on-white palette,
   and offers no way out — on a dark site, arriving from a pasted link, that
   reads as broken. Server-rendered so it exists without JS. */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-5 pt-20 pb-20 sm:px-6">
      <p className="text-[11px] tracking-[0.24em] text-faint uppercase">Nothing here</p>
      <h1 className="mt-4 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
        That page does not exist.
      </h1>
      <p className="prose-tight mt-5 max-w-prose text-lg leading-relaxed text-body">
        The two that do are the front door, where you paste a product, and the bank,
        which is every ask we have indexed.
      </p>
      <p className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link
          href="/"
          className="rounded-full border border-edge px-5 py-2.5 text-sm text-body transition-colors hover:border-accent hover:text-accent"
        >
          Find your people
        </Link>
        <Link href="/bank" className="text-sm text-accent underline underline-offset-4">
          The bank
        </Link>
      </p>
    </main>
  );
}

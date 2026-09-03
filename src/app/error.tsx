"use client";

import { useEffect } from "react";
import Link from "next/link";

/* /find fetches a page somebody else controls and parses whatever comes back.
   That is the most likely thing here to throw, and without this the whole route
   white-screens behind Next's default. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[render] failed", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col px-5 pt-20 pb-20 sm:px-6">
      <p className="text-[11px] tracking-[0.24em] text-faint uppercase">That did not work</p>
      <h1 className="mt-4 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl">
        Something broke on our side.
      </h1>
      <p className="prose-tight mt-5 max-w-prose text-lg leading-relaxed text-body">
        Most often this is a page that would not parse. Nothing you did caused it and
        nothing was stored.
      </p>
      <p className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
        <button
          onClick={reset}
          className="rounded-full border border-edge px-5 py-2.5 text-sm text-body transition-colors hover:border-accent hover:text-accent"
        >
          Try again
        </button>
        <Link href="/" className="text-sm text-accent underline underline-offset-4">
          Start over
        </Link>
      </p>
      {error.digest && <p className="mt-8 text-xs text-faint">Reference {error.digest}</p>}
    </main>
  );
}

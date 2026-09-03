"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The field, twice: once in the hero, and once as a bar that arrives after the
 * hero has scrolled away. Both post the same form to /find, so the bar is not a
 * second code path — it is the same input, still reachable once the wire has
 * taken over the screen.
 */
export function Paste({ big = false }: { big?: boolean }) {
  return (
    <form action="/find" className={big ? "flex flex-col gap-2.5 sm:flex-row" : "flex gap-2"}>
      <input
        name="url"
        type="text"
        inputMode="url"
        required
        autoFocus={big}
        placeholder="yourproduct.com"
        aria-label="Your product's web address"
        className={
          big
            ? "min-w-0 flex-1 rounded-xl border border-edge bg-ground/80 px-4 py-3.5 font-mono text-ink outline-none placeholder:text-faint focus:border-accent"
            : "min-w-0 flex-1 rounded-lg border border-edge bg-ground/80 px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-faint focus:border-accent"
        }
      />
      <button
        className={
          big
            ? "rounded-xl bg-accent px-7 py-3.5 text-sm font-medium tracking-[0.04em] text-ground"
            : "shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ground"
        }
      >
        Find them
      </button>
    </form>
  );
}

/** Slides in only once the hero field is gone, so it never doubles on screen.
 *  Render it directly BELOW the hero field: the marker is a sibling in the flow
 *  and the bar is fixed, so where this sits in the DOM decides when it shows and
 *  not where it shows. Placed at the top of the page it fires at scroll 0. */
export function StickyPaste() {
  const [on, setOn] = useState(false);
  const mark = useRef<HTMLDivElement>(null);

  /* A scroll listener rather than an IntersectionObserver, and no
     requestAnimationFrame throttle — both for the same reason: they can be
     exercised in the preview browser and IO cannot.

     The first draft used IO. It never fired, at any viewport, and the first
     conclusion drawn was that IO was broken here. It is not: the preview
     document reports visibilityState "hidden", and a hidden document runs
     neither IO delivery nor rAF callbacks. The API was fine; the measurement
     was worthless. A plain scroll listener reads the rect directly, so a
     dispatched scroll event proves the whole chain while the page is hidden.
     Browsers already coalesce scroll to one event per frame, so one
     getBoundingClientRect per frame is what the rAF version cost anyway. */
  useEffect(() => {
    const el = mark.current;
    if (!el) return;
    const read = () => setOn(el.getBoundingClientRect().bottom < 0);
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, []);

  return (
    <>
      <div ref={mark} aria-hidden className="h-px" />
      <div
        className={`fixed inset-x-0 top-0 z-30 border-b border-rule bg-ground/85 backdrop-blur transition-transform duration-200 ${
          on ? "translate-y-0" : "-translate-y-full"
        }`}
        /* Hidden from the keyboard while it is off screen: a focusable control
           parked above the viewport steals the first Tab and scrolls to nowhere.
           React 19 takes `inert` as a real boolean — an empty string reads as
           false and the guard silently does nothing. */
        inert={!on}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-2.5 sm:px-6">
          <span className="hidden shrink-0 text-[11px] tracking-[0.2em] text-faint uppercase sm:block">
            Intent threads
          </span>
          <div className="min-w-0 flex-1">
            <Paste />
          </div>
        </div>
      </div>
    </>
  );
}

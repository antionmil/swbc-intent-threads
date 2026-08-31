/** The state you will NOT have time to design on a viral day. Build it now. */
export function Exhausted({ reason, limit }: { reason: "ip" | "ceiling"; limit?: number }) {
  const copy =
    reason === "ip"
      ? {
          h: "That is your " + (limit ?? 3) + " for today",
          p: "The result you already generated is still on this page and still shareable. Come back tomorrow for more.",
        }
      : {
          h: "Busy day - generation is paused",
          p: "More people showed up than this runs on. Everything already generated is still here and still readable. New results resume tomorrow.",
        };
  return (
    <div className="rounded-lg border border-rule bg-surface p-6">
      <h2 className="font-display text-lg font-semibold">{copy.h}</h2>
      <p className="mt-2 max-w-prose text-muted">{copy.p}</p>
    </div>
  );
}

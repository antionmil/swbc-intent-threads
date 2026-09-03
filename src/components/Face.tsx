/* Measured against the disc the letters actually sit on, not the page behind it:
   6.33, 7.56, 6.60, 6.97, 6.80, 6.63 — all clear AA at 4.5 for the 12px they
   render at. Day 2 documented three ratios against the wrong background. */
const TONES = [
  ["#2b3a44", "#9fc4d6"], ["#33362b", "#c8cf9f"], ["#3a2f38", "#d3b0cb"],
  ["#2f3a33", "#a8d0b6"], ["#3b342a", "#d8bd94"], ["#2c3140", "#b0b8dd"],
] as const;

/**
 * A face, but only a real one.
 *
 * GitHub gives a photograph derived from the handle and YouTube hands one back
 * with the comment. Hacker News has none — its user record is about, karma and
 * username, nothing else. So HN gets initials on a colour picked from the name,
 * and never a stock portrait: a stand-in photograph beside a real person's real
 * words is not a placeholder, it is an invention.
 */
export function Face({ who, src, avatar, size = 34 }: {
  who: string; src: string; avatar?: string; size?: number;
}) {
  const initials = (who.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/)[0] ?? "?")
    .slice(0, 2).toUpperCase();
  let h = 0;
  for (const c of who) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = TONES[h % TONES.length];

  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, background: bg }}
      title={`${who} on ${src}`}
    >
      {avatar ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={avatar}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-mono font-medium"
          style={{ color: fg, fontSize: size * 0.36 }}
          aria-hidden
        >
          {initials}
        </span>
      )}
    </span>
  );
}

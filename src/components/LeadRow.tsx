import { why, type Hit } from "@/lib/corpus";
import { Face } from "@/components/Face";

const TONE = {
  strong: "border-good/60 text-good",
  "worth a look": "border-warm/50 text-warm",
  loose: "border-rule text-faint",
} as const;

/** Highlight the words that actually caused the match, in their sentence. */
function Marked({ text, shared }: { text: string; shared: string[] }) {
  if (shared.length === 0) return <>{text}</>;
  const re = new RegExp(`\\b(${shared.map(esc).join("|")})\\b`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        shared.some((s) => s.toLowerCase() === p.toLowerCase()) ? (
          <mark key={i} className="bg-transparent text-ink underline decoration-accent decoration-2 underline-offset-2">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function LeadRow({ hit, band }: { hit: Hit; band: keyof typeof TONE }) {
  const { lead, shared } = hit;
  const where =
    lead.src === "github" ? lead.repo || "GitHub"
    : lead.src === "youtube" ? "YouTube"
    : "Hacker News";
  /* The badge is the evidence, not a verdict: the rare words this person and
     your product both used. */
  const on = why(hit);

  return (
    /* Stacked on a phone, three columns from `sm` up.
     *
     * As a flex row at every width this put the person's words in a 20-to-66px
     * column on a 388px viewport — measured — because the evidence badge took
     * 141px and the reply pill 80px before the text got any. The words are the
     * product; they get the full width when there is not much of it. */
    <li className="border-b border-rule py-5 sm:flex sm:gap-4">
      <span
        className={`mb-2.5 inline-block h-fit rounded-full border px-2.5 py-1 font-mono text-[11px] whitespace-nowrap sm:mt-0.5 sm:mb-0 sm:shrink-0 ${TONE[band]}`}
        title={`${band} match — shared with your page: ${shared.join(", ")}`}
      >
        {/* The band was carried by the border and text colour and nothing else,
            so it did not exist for anyone who cannot see the difference between
            green and amber. Said in words, to screen readers only, because the
            colour is doing fine for everybody else. */}
        <span className="sr-only">{band} match: </span>
        {on.join(" · ")}
      </span>

      <div className="min-w-0 flex-1">
        {/* break-words, because a lead can contain a URL or an unbroken
            identifier longer than a phone is wide. */}
        <p className="prose-tight leading-relaxed break-words text-body">
          <Marked text={lead.wish} shared={shared} />
        </p>
        {/* The video, not decoration: "what would you recommend for a cleaning
            business" means nothing until you know it was asked under a video
            about invoicing software. */}
        {lead.ctx && (
          <p className="mt-1.5 text-xs text-faint">
            asked under <span className="text-muted">{lead.ctx}</span>
          </p>
        )}
        {/* The face sits on the byline, not at the head of the row: the left
            edge belongs to the match evidence, which is the argument. Here it
            does the one job it is for — this is a person, not a record. */}
        <p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted">
          <Face who={lead.who} src={lead.src} avatar={lead.avatar} size={22} />
          <span>
            {lead.who} · {where} · {lead.when}
          </span>
        </p>
      </div>

      <span className="mt-3 block h-fit sm:mt-0.5 sm:shrink-0">
        <a
          href={lead.url}
          target="_blank"
          rel="noopener nofollow"
          /* Every one of these links said only "reply", so a screen-reader list
             of links on /bank was 249 identical entries. */
          aria-label={`Reply to ${lead.who} on ${where}`}
          className="inline-block rounded-full border border-edge px-4 py-1.5 text-sm text-body transition-colors hover:border-accent hover:text-accent"
        >
          reply ↗
        </a>
      </span>
    </li>
  );
}

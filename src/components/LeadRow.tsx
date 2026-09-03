import { why, type Hit } from "@/lib/corpus";

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
    <li className="flex gap-4 border-b border-rule py-5">
      <span
        className={`mt-0.5 h-fit shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] whitespace-nowrap ${TONE[band]}`}
        title={`Shared with your page: ${shared.join(", ")}`}
      >
        {on.join(" · ")}
      </span>

      <div className="min-w-0 flex-1">
        <p className="prose-tight leading-relaxed text-body">
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
        <p className="mt-2 font-mono text-xs text-muted">
          {lead.who} · {where} · {lead.when}
        </p>
      </div>

      <a
        href={lead.url}
        target="_blank"
        rel="noopener nofollow"
        className="mt-0.5 h-fit shrink-0 rounded-full border border-edge px-4 py-1.5 text-sm text-body transition-colors hover:border-accent hover:text-accent"
      >
        reply ↗
      </a>
    </li>
  );
}

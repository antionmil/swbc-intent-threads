/** Reads from env. Renders an honest placeholder until a sponsor exists.
 *  Do not build a sponsor CMS - build that the day you sell one. */
export function SponsorSlot() {
  const name = process.env.SPONSOR_NAME;
  const url = process.env.SPONSOR_URL;
  const tagline = process.env.SPONSOR_TAGLINE;

  if (!name || !url) {
    return (
      <div className="rounded-lg border border-dashed border-rule px-4 py-3 text-sm text-muted">
        This slot is open. <span className="text-ink">Sponsor this page.</span>
      </div>
    );
  }
  return (
    <a
      href={url}
      rel="sponsored noopener"
      className="block rounded-lg border border-rule bg-surface px-4 py-3 text-sm hover:border-accent"
    >
      <span className="font-semibold text-ink">{name}</span>
      {tagline ? <span className="text-muted"> - {tagline}</span> : null}
    </a>
  );
}

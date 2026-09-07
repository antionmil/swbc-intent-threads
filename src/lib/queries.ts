import "server-only";

/**
 * What to go looking for on YouTube.
 *
 * The first 78 of these were every query the corpus was ever built from, and
 * every one of them is "best X software for small business". That is one slice
 * of one market. It is why a visitor could paste an AI interior-design tool and
 * be told nobody had asked for it: nobody had, because nothing had ever looked
 * anywhere near interior design.
 *
 * The rest widen it deliberately. A "best X app" video is the right place to
 * look whatever the subject, because its comments are people saying what they
 * still cannot find — which is the only thing this site collects.
 *
 * The cron rotates through a slice per day rather than running all of them:
 * a search costs 100 quota units against a daily 10,000, so the whole list at
 * once would eat a day's budget and leave nothing for reading comments.
 */
export const QUERIES: string[] = [
  // --- small-business software (the original list) ---------------------------
  "best invoicing software small business", "best accounting software freelancers",
  "best crm small business", "best project management tool", "best note taking app",
  "best form builder", "best web analytics tool", "best email marketing platform",
  "best password manager", "best scheduling software", "best time tracking app",
  "best pos system small business", "best website builder small business",
  "best help desk software", "best inventory management software",
  "best e-signature software", "best social media scheduler", "best backup software",
  "best expense tracking app", "best appointment booking software",
  "best payroll software small business", "best bookkeeping software",
  "best client portal software", "best knowledge base software",
  "best live chat software website", "best seo tool small business",
  "best landing page builder", "best ecommerce platform small business",
  "best subscription billing software", "best field service management software",
  "best salon booking software", "best restaurant pos system",
  "best gym management software", "best property management software",
  "best law firm case management software", "best construction estimating software",
  "best cleaning business software", "best photography studio management software",
  "best nonprofit donor management software", "best applicant tracking system small business",

  // --- design, and the reason this file exists -------------------------------
  "best interior design app", "best interior design software beginners",
  "best room planner app", "best floor plan app", "best home design software",
  "best virtual staging software", "best kitchen design software",
  "best landscape design software", "best 3d rendering software architecture",
  "best cad software beginners", "best furniture design software",
  "best home renovation app", "best moodboard app designers",
  "best graphic design software beginners", "best logo design software",
  "best photo editing software", "best photo editing app phone",
  "best video editing software beginners", "best video editing app phone",
  "best ui ux design tool", "best prototyping tool designers",
  "best colour palette tool", "best font manager", "best stock photo site",

  // --- creators and media ----------------------------------------------------
  "best podcast editing software", "best music production software beginners",
  "best audio editing software", "best streaming software", "best thumbnail maker",
  "best screen recording software", "best transcription software",
  "best subtitle software", "best photo organising software",
  "best video hosting for creators", "best newsletter platform creators",

  // --- home, property and trades ---------------------------------------------
  "best real estate crm agents", "best home inventory app",
  "best diy home improvement app", "best gardening planner app",
  "best smart home app", "best home security camera app",
  "best contractor invoicing app", "best trade quoting app",

  // --- personal and everyday --------------------------------------------------
  "best budgeting app", "best personal finance app", "best habit tracker app",
  "best journaling app", "best meal planning app", "best recipe organiser app",
  "best workout tracker app", "best running app", "best meditation app",
  "best sleep tracking app", "best language learning app", "best flashcard app",
  "best study app students", "best reading app", "best ebook reader app",
  "best travel planning app", "best packing list app", "best pet care app",
  "best baby tracker app", "best wedding planning app",

  // --- work, career and study -------------------------------------------------
  "best resume builder", "best portfolio website builder",
  "best freelance contract software", "best proposal software freelancers",
  "best whiteboard app remote teams", "best mind mapping software",
  "best diagram tool", "best presentation software alternative",
  "best spreadsheet alternative", "best database app no code",

  // --- technical, where GitHub does not reach ---------------------------------
  "best no code app builder", "best automation tool zapier alternative",
  "best self hosted apps", "best home server software", "best nas software",
  "best vpn small business", "best cloud storage small business",
  "best document management software", "best uptime monitoring tool",
  "best api testing tool", "best log management tool", "best error tracking tool",
];

/** A slice for today, rotating so every query comes round without a spike. */
export function slice(size: number, day = new Date()): string[] {
  const n = QUERIES.length;
  const start = (Math.floor(day.getTime() / 864e5) * size) % n;
  return Array.from({ length: Math.min(size, n) }, (_, i) => QUERIES[(start + i) % n]);
}

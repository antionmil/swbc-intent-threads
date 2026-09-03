/**
 * What kind of thing the person was asking for.
 *
 * Derived from the corpus rather than invented: the YouTube half is small
 * businesses shopping for software (accounting, CRM, booking, invoicing, POS),
 * and the GitHub half is developers and self-hosters. The categories below are
 * those two populations, split where the vocabulary actually splits.
 *
 * Rules, not a model. A classifier in the request path is the thing the house
 * rules forbid, and a per-row label that only a cron can produce is the thing
 * they ask for instead — so this runs once when a lead is mined and the answer
 * is stored on the row.
 *
 * Order matters: the first list to match wins, so the narrow, high-signal
 * categories are checked before the broad ones. "invoice" beats "software".
 */
/* No "Everything else" chip. A third of these wishes are genuinely
   miscellaneous — somebody wanting a better airport app, a hiring site that
   caps applications, a WLTP comparison for car software — and nine more
   categories only moved that third to a quarter while adding nine chips for
   buckets of eleven rows. So the filter NARROWS rather than partitions: pick a
   category to see it, pick All to see everything including the tail. */
export const TOPICS = [
  { key: "ai", label: "AI & agents" },
  { key: "dev", label: "Developer tools" },
  { key: "media", label: "Media & games" },
  { key: "docs", label: "Docs & files" },
  { key: "biz", label: "Business & sales" },
  { key: "work", label: "Work & planning" },
  { key: "site", label: "Websites & design" },
  { key: "infra", label: "Servers & self-hosting" },
] as const;

/* "other" is a real answer but not a chip — see the note above. */
export type TopicKey = (typeof TOPICS)[number]["key"] | "other";

/* Each term is matched on a word boundary against the wish, the repository and
   the video title together — the container is often the clearest signal a
   comment has ("Best Restaurant POS Systems" tells you more than the comment). */
const RULES: [TopicKey, string[]][] = [
  ["ai", ["llm", "gpt", "chatgpt", "claude", "openai", "anthropic", "copilot", "prompt", "prompts",
    "agent", "agents", "agentic", "rag", "embedding", "embeddings", "fine-?tun\\w*", "inference",
    "ollama", "langchain", "mcp", "subagent", "subagents", "ai"]],

  ["biz", ["invoice", "invoicing", "invoices", "accounting", "bookkeeping", "quickbooks", "xero",
    "payroll", "billing", "expense", "expenses", "receipt", "receipts", "tax", "taxes", "vat",
    "pos", "point.of.sale", "payment", "payments", "stripe", "budget", "budgeting", "ledger",
    "invoiced", "salaries", "banking", "reimbursement"]],

  /* "lead" and "leads" were here and put "glaciers at risk that could lead to a
     similar event" under Business & sales. The verb is far commoner than the
     noun in ordinary English, and the category stands up without it. */
  ["biz", ["crm", "sales.lead", "sales.leads", "prospect", "prospects", "outreach", "cold.email",
    "newsletter", "mailchimp", "convertkit", "activecampaign", "klaviyo", "campaign", "campaigns",
    "email.marketing", "seo", "funnel", "landing.page", "affiliate", "ads", "advertising",
    "subscriber", "subscribers", "hubspot", "pipedrive", "salesforce"]],

  ["work", ["project.management", "task", "tasks", "todo", "to-do", "kanban", "scrum", "sprint",
    "asana", "trello", "clickup", "notion", "jira", "monday", "calendar", "scheduling", "schedule",
    "appointment", "appointments", "booking", "bookings", "note.taking", "notes", "obsidian",
    "timesheet", "time.tracking", "productivity", "reminder", "reminders", "inventory", "roster",
    "hr", "recruiting", "onboarding"]],

  ["infra", ["docker", "kubernetes", "k8s", "self.host\\w*", "selfhost\\w*", "homelab", "nas",
    "proxmox", "unraid", "truenas", "backup", "backups", "server", "servers", "vps", "nginx",
    "reverse.proxy", "dns", "vpn", "firewall", "raid", "zfs", "synology", "casaos", "systemd",
    "cron", "sysadmin", "networking", "router"]],

  ["media", ["video", "videos", "audio", "music", "podcast", "photo", "photos", "image", "images",
    "game", "games", "gaming", "stream", "streaming", "plex", "jellyfin", "kodi", "emby", "player",
    "subtitle", "subtitles", "camera", "movie", "movies", "series", "anime", "playlist", "spotify",
    "youtube", "twitch", "steam", "epub", "ebook", "reader", "comic"]],

  ["site", ["website", "websites", "web.?site.builder", "wordpress", "webflow", "squarespace",
    "shopify", "wix", "css", "tailwind", "theme", "themes", "landing", "figma", "design", "designer",
    "font", "fonts", "icon", "icons", "logo", "svg", "layout", "responsive", "ux", "ui"]],

  ["dev", ["api", "apis", "sdk", "cli", "library", "framework", "compiler", "linter", "debugger",
    "debugging", "ide", "vscode", "vs.code", "jetbrains", "neovim", "git", "github", "gitlab",
    "repo", "repository", "pull.request", "ci", "cd", "pipeline", "typescript", "javascript",
    "python", "rust", "golang", "java", "npm", "pip", "cargo", "package", "dependency",
    "dependencies", "test", "tests", "testing", "sql", "database", "postgres", "mysql", "sqlite",
    "regex", "json", "yaml", "extension", "plugin", "webhook", "oauth", "auth", "terminal",
    "shell", "bash", "script", "scripting", "code", "coding", "developer", "programming"]],

  ["docs", ["document", "documents", "pdf", "markdown", "writing", "editor", "translate",
    "translation", "spellcheck", "grammar", "wiki", "notebook", "converter", "convert",
    "sync", "syncing", "dropbox", "archive", "spreadsheet", "csv", "excel",
    /* "file", "files", "folder", "download" and "convert" were in here and made
       this the largest bucket on the site by stealing from every other one —
       a developer asking about a config file is not asking about documents.
       Checked last now, and only on vocabulary that means the document itself. */
    "ebook", "epub", "docx", "latex", "ocr", "scan", "scanned"]],
];

const COMPILED: [TopicKey, RegExp][] = RULES.map(([k, words]) => [
  k,
  new RegExp(`\\b(?:${words.join("|")})\\b`, "i"),
]);

/** The first category whose vocabulary appears. "other" when none does. */
export function topicOf(wish: string, repo = "", ctx = ""): TopicKey {
  /* URLs out first. A link to en.wikipedia.org put "I wish there were more
     Planets" under Docs & files, because the path contained "wiki". A web
     address describes where something is, never what it is about. */
  const hay = `${wish} ${repo.replace(/[/_-]+/g, " ")} ${ctx}`.replace(/https?:\/\/\S+/g, " ");
  for (const [key, re] of COMPILED) if (re.test(hay)) return key;
  return "other";
}

export const TOPIC_LABEL: Record<string, string> = Object.fromEntries(
  TOPICS.map((t) => [t.key, t.label]),
);

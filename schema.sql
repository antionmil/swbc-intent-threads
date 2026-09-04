-- Intent threads. Run this ONCE against the swbc-intent-threads Neon project.
-- NOT against any other project: day 1 ran a schema into the wrong database.

create table if not exists leads (
  id          text primary key,          -- sha1 of author + first words of the ask
  src         text not null,             -- github | hn | youtube
  who         text not null,
  repo        text not null default '',
  ctx         text not null default '',  -- the video a YouTube comment sits under
  asked_on    date,
  wish        text not null,
  url         text not null unique,
  score       real not null default 0.5,
  -- Generated, so it can never drift from `wish`. The video context is folded
  -- in because a comment like "which for a cleaning business" carries no
  -- product vocabulary of its own — the video title is where it comes from.
  fts         tsvector generated always as (
                to_tsvector('english', coalesce(wish,'') || ' ' || coalesce(ctx,''))
              ) stored,
  first_seen  timestamptz not null default now()
);

create index if not exists leads_fts_idx     on leads using gin (fts);
create index if not exists leads_asked_idx   on leads (asked_on desc);
create index if not exists leads_score_idx   on leads (score desc);

-- People who asked to be taken out. Checked on write AND on read, so a lead
-- cannot reappear just because the miner found it again tomorrow.
create table if not exists blocked (
  who        text primary key,
  blocked_at timestamptz not null default now()
);

-- What the cron did, so a silent failure is visible instead of just "no new
-- leads today".
create table if not exists runs (
  id         bigserial primary key,
  source     text not null,
  started_at timestamptz not null default now(),
  found      integer not null default 0,
  added      integer not null default 0,
  note       text
);

-- Videos worth re-reading. Discovery is the expensive half on YouTube
-- (search.list costs 100 units and is capped at 100 calls a day) while reading
-- a video's comments costs 1, so the list is kept and only the reading repeats.
create table if not exists videos (
  id         text primary key,
  title      text not null,
  found_at   timestamptz not null default now(),
  last_read  timestamptz
);
create index if not exists videos_stale_idx on videos (last_read nulls first);

-- A face, where one genuinely exists.
-- GitHub is derivable from the handle; YouTube hands one back with the comment;
-- Hacker News has none at all (its user record is about/karma/username), so
-- those fall back to a monogram in the UI. Never a stand-in photograph for a
-- real named person.
alter table leads add column if not exists avatar text;

/* What kind of thing the person was asking for: a rules classifier over the
   wish, the repository and the video title, run once when the lead is mined.
   NULL for the third that is genuinely miscellaneous — the filter narrows
   rather than partitions, so those show under "All" and nowhere else. */
alter table leads add column if not exists topic text;
create index if not exists leads_topic_idx on leads (topic) where topic is not null;

/* Who is here, right now, and nothing else.
 *
 * One row per visitor, keyed on a salted hash of their IP — not a cookie, not
 * anything written to their browser, so the front page's promise that nothing
 * is kept there stays true. The hash is one-way and the row is deleted after
 * five minutes, so the table cannot say who was here, only how many. Keying on
 * the address rather than a number the browser makes up is also what stops one
 * person inventing a hundred ids and inflating a figure shown to everyone. */
create table if not exists presence (
  id text primary key,
  seen_at timestamptz not null default now()
);
create index if not exists presence_seen_idx on presence (seen_at);

/* YouTube data is deleted 30 days after WE retrieved it, per the YouTube API
   Services Developer Policies III.E.4.c — "not longer than 30 calendar days"
   for non-authorized data. Enforced at the top of every cron run rather than
   inside the YouTube job, so it still happens on days the miner fails.
   first_seen is the retrieval time, which is the clock the policy counts. */
create index if not exists leads_youtube_age_idx on leads (first_seen) where src = 'youtube';

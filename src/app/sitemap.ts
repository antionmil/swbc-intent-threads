import type { MetadataRoute } from "next";

const SITE = "https://intentthreads.onedaybuilt.com";

/* /bank is not in here on purpose.
 *
 * It lists 249 named people, their words and a link, and submitting it for
 * daily crawl would put a stranger's 2019 Hacker News comment into Google under
 * their handle, on a page about finding leads. Republishing something public is
 * one thing; actively making it findable by name is a further step, and not one
 * this site needs — the front page is the product, and it is indexed. /bank
 * stays reachable and linkable for anyone who wants to read it, and carries
 * `noindex` so a search engine leaves it alone. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/privacy`, changeFrequency: "monthly", priority: 0.3 },
  ];
}

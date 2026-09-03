import type { MetadataRoute } from "next";

const SITE = "https://intentthreads.onedaybuilt.com";

/* /find takes a URL from the query string and fetches it. A crawler walking
   those would have us fetching arbitrary pages on its schedule, not a
   visitor's, so it is closed.

   /bank is closed too, for a different reason: 249 named people per page, and
   nobody who wrote a comment in 2019 expected it indexed under their handle on
   a lead-generation site. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/privacy"], disallow: ["/find", "/bank"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}

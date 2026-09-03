import type { MetadataRoute } from "next";

const SITE = "https://intentthreads.onedaybuilt.com";

/* /find takes a URL from the query string and fetches it. A crawler walking
   those would have us fetching arbitrary pages on its schedule, not a
   visitor's, so it is closed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/bank"], disallow: ["/find"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}

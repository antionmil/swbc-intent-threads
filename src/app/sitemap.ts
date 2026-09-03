import type { MetadataRoute } from "next";

const SITE = "https://intentthreads.onedaybuilt.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    { url: `${SITE}/bank`, changeFrequency: "daily", priority: 0.8 },
  ];
}

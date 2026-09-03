import type { NextConfig } from "next";

const config: NextConfig = {
  /* Avatars are rendered with a plain <img>, not next/image: they come from two
     hosts we do not control, they are already 96px, and putting the optimizer
     in front of 1,900 third-party images would bill for work nobody needs. */
  async headers() {
    return [
      {
        /* /find fetches a URL a stranger supplied. Caching it at the edge is the
           real mitigation available without a datastore: the result is a pure
           function of (url, corpus), identical for everybody, so the second and
           every later request for the same URL costs no outbound fetch at all.
           That removes the amplification — one attacker hammering one target
           gets one fetch.

           What it does NOT solve is somebody walking thousands of DISTINCT
           URLs. A global limit needs shared state and this site deliberately
           has no database, so that is written down rather than papered over
           with a per-instance counter — day 1 of this run shipped exactly that
           and it did nothing under load. */
        source: "/find",
        headers: [
          { key: "cache-control", value: "public, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "x-content-type-options", value: "nosniff" },
          { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
          { key: "x-frame-options", value: "SAMEORIGIN" },
          { key: "permissions-policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default config;

import { ImageResponse } from "next/og";
import { total } from "@/lib/leads";

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "Intent threads — people already asked for what you built";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* No font fetch. Day 2's certificate memoised a failed Google Fonts request and
   served glyphless images for the life of the lambda; satori's built-in face is
   one less thing that can break the only image a shared link ever shows. */
/* The card every shared link renders. It printed the bundled artifact's length
   and named two of the three sources: "1,905 public asks · Hacker News and
   GitHub" under a page that said 1,931 and listed YouTube rows. The one surface
   nobody on the site ever sees, and the one everybody on X does. */
export default async function Image() {
  const count = await total();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", background: "#0d0f12", color: "#e9eaec", padding: 78,
        }}
      >
        <div style={{ display: "flex", fontSize: 20, letterSpacing: 6, color: "#7fb3d5" }}>
          INTENT THREADS
        </div>
        <div style={{ display: "flex", fontSize: 78, lineHeight: 1.1, marginTop: 22, letterSpacing: -2 }}>
          People already asked for what you built.
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#a2a8b0", marginTop: 26, maxWidth: 940 }}>
          Paste your product. Find the strangers who said they wanted it, and where to go and say hello.
        </div>
        <div style={{ display: "flex", fontSize: 22, color: "#868d97", marginTop: 34 }}>
          {count.toLocaleString()} public asks · GitHub, Hacker News and YouTube · no sign-up
        </div>
      </div>
    ),
    size,
  );
}

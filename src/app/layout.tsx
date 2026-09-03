import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const TITLE = "Intent threads";
const DESC =
  "Paste your product. Find the strangers who already asked for it in public, and where to go and say hello.";

export const metadata: Metadata = {
  metadataBase: new URL("https://intentthreads.onedaybuilt.com"),
  title: TITLE,
  description: DESC,
  openGraph: { title: TITLE, description: DESC, type: "website", siteName: TITLE },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    {/* No theme script: this site has no toggle, so the localStorage read
        copied over from day 2 was dead code — and it made the privacy line
        untrue for no benefit. */}
    <html lang="en" data-theme="dark">
      <body className="min-h-dvh antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

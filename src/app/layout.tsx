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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Set before first paint, or a returning light-theme visitor gets one
            dark frame and a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('it.theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/* A thread with a knot in it: one line running through, one point on it where
   somebody said what they wanted. Drawn rather than fetched — no font, no
   network, nothing that can fail the way day 2's font request did. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "#0d0f12", borderRadius: 14,
        }}
      >
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <path
            d="M10 46 C 22 46, 22 18, 34 18 C 44 18, 46 30, 54 30"
            stroke="#7fb3d5" strokeWidth="5" strokeLinecap="round"
          />
          <circle cx="34" cy="18" r="7.5" fill="#86b89b" />
        </svg>
      </div>
    ),
    size,
  );
}

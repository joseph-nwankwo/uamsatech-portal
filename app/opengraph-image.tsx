import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

export const runtime = "edge";
export const alt = siteConfig.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a2540",
        backgroundImage:
          "radial-gradient(circle at 50% 0%, rgba(47,111,235,0.35), rgba(10,37,64,0) 60%)",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 88,
            height: 88,
            borderRadius: 20,
            backgroundColor: "#ffffff",
            color: "#0a2540",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          U
        </div>
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          {siteConfig.name}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 28,
          fontSize: 32,
          color: "rgba(255,255,255,0.8)",
          textAlign: "center",
          maxWidth: 820,
        }}
      >
        {siteConfig.tagline}
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 44,
          gap: 12,
        }}
      >
        {["#c9a227", "#2f6feb", "#ffffff"].map((color) => (
          <div
            key={color}
            style={{
              width: 56,
              height: 6,
              borderRadius: 3,
              backgroundColor: color,
            }}
          />
        ))}
      </div>
    </div>,
    { ...size }
  );
}

import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/features/blog/queries";

export const alt = "UAMSATech Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  const title = post?.title ?? "UAMSATech Blog";
  const category = post?.category?.name;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
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
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "#ffffff",
            color: "#0a2540",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          U
        </div>
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize: 28,
            fontWeight: 700,
          }}
        >
          UAMSATech
        </div>
        {category && (
          <div
            style={{
              display: "flex",
              marginLeft: 8,
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 20,
              color: "#c9a227",
              border: "1px solid rgba(201,162,39,0.5)",
            }}
          >
            {category}
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          color: "#ffffff",
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: 1.15,
          maxWidth: 980,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
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

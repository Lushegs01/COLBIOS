import { ImageResponse } from "next/og";

export const alt = "COLBIOS Dues — Pay your dues. Stay cleared.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAFAF8",
          backgroundImage:
            "radial-gradient(circle at 50% 120%, rgba(11, 93, 74, 0.14) 0%, rgba(11, 93, 74, 0) 55%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 9999,
              backgroundColor: "#0B5D4A",
            }}
          />
          <span
            style={{
              fontSize: 34,
              letterSpacing: "-0.02em",
              fontWeight: 600,
              color: "#111111",
            }}
          >
            COLBIOS
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            color: "#111111",
          }}
        >
          <span
            style={{
              fontSize: 88,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
            }}
          >
            Pay your dues.
          </span>
          <span
            style={{
              fontSize: 88,
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
            }}
          >
            Stay cleared.
          </span>
        </div>
        <span
          style={{
            marginTop: 36,
            fontSize: 28,
            color: "#6B7280",
          }}
        >
          College of Biosciences · Federal University of Agriculture, Abeokuta
        </span>
      </div>
    ),
    { ...size }
  );
}

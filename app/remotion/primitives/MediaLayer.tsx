import React from "react";
import { Img, OffthreadVideo } from "remotion";
import type { ResolvedAsset } from "@/app/lib/videoPlan/types";

function Placeholder({ rounded }: { rounded: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: rounded,
        border: "1px solid rgba(148,163,184,0.16)",
        background:
          "radial-gradient(circle at 20% 20%, rgba(167,255,90,0.22), transparent 34%), radial-gradient(circle at 78% 28%, rgba(125,211,252,0.22), transparent 30%), linear-gradient(160deg, rgba(5,8,22,0.98), rgba(8,20,38,0.92), rgba(17,24,39,0.98))",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "12%",
          borderRadius: rounded - 12,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          boxShadow: "inset 0 0 80px rgba(125,211,252,0.12)",
        }}
      />
    </div>
  );
}

export function MediaLayer({ asset, rounded = 36 }: { asset?: ResolvedAsset; rounded?: number }) {
  if (!asset) {
    return <Placeholder rounded={rounded} />;
  }

  const src = asset.localPath || asset.url;
  if (!src) return <Placeholder rounded={rounded} />;

  if (asset.kind === "video") {
    return (
      <OffthreadVideo
        src={src}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: rounded }}
      />
    );
  }

  return (
    <Img
      src={src}
      style={{
        width: "100%",
        height: "100%",
        objectFit: asset.kind === "logo" ? "contain" : "cover",
        borderRadius: rounded,
        background: asset.kind === "logo" ? "rgba(255,255,255,0.04)" : undefined,
        padding: asset.kind === "logo" ? 50 : 0,
      }}
    />
  );
}

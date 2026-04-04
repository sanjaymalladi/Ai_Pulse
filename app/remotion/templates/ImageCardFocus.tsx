import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { DataBadge } from "../primitives/DataBadge";
import { MediaLayer } from "../primitives/MediaLayer";
import { SceneFrame } from "../primitives/SceneFrame";
import type { ScenePlan } from "@/app/lib/videoPlan/types";

export function ImageCardFocus({ scene, palette }: { scene: ScenePlan; palette: string[] }) {
  const frame = useCurrentFrame();
  const media = scene.resolvedAssets.find((asset) => asset.kind === "image" || asset.kind === "video");
  const zoom = interpolate(frame, [0, 90], [1.12, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame palette={palette} accentIndex={2}>
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }}>
          <MediaLayer asset={media} rounded={0} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(5,8,22,0.05) 0%, rgba(5,8,22,0.18) 28%, rgba(5,8,22,0.84) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 56,
            top: 76,
            width: 360,
            padding: 24,
            borderRadius: 28,
            background: "rgba(7,12,28,0.56)",
            border: "1px solid rgba(148,163,184,0.18)",
            backdropFilter: "blur(14px)",
          }}
        >
          <p style={{ fontSize: 20, lineHeight: 1.55, color: "rgba(226,232,240,0.74)" }}>{scene.visualIntent}</p>
        </div>
        <div style={{ position: "absolute", left: 42, right: 42, bottom: 46, display: "flex", flexDirection: "column", gap: 16 }}>
          <DataBadge label="Hero Visual" accent="#f59e0b" />
          <h1 style={{ fontSize: 112, lineHeight: 0.86, maxWidth: 840, color: "#fff7ed", textTransform: "uppercase" }}>
            {(scene.headline || scene.voiceText.slice(0, 56)).split(/\s+/).slice(0, 7).join(" ")}
          </h1>
          <p style={{ fontSize: 28, color: "rgba(255,247,237,0.82)", maxWidth: 720 }}>{scene.subhead || scene.visualIntent}</p>
        </div>
      </div>
    </SceneFrame>
  );
}

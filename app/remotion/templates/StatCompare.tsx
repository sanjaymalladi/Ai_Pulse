import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { AnimatedCounter } from "remotion-bits";
import { DataBadge } from "../primitives/DataBadge";
import { SceneFrame } from "../primitives/SceneFrame";
import type { ScenePlan } from "@/app/lib/videoPlan/types";

export function StatCompare({ scene, palette }: { scene: ScenePlan; palette: string[] }) {
  const frame = useCurrentFrame();
  const bars = scene.keywords.slice(0, 4);

  return (
    <SceneFrame palette={palette} accentIndex={3}>
      <div style={{ position: "absolute", inset: 54, display: "flex", flexDirection: "column" }}>
        <DataBadge label="Signal Compare" accent="#ff8fab" />
        <h1 style={{ fontSize: 106, lineHeight: 0.88, marginTop: 18, maxWidth: 840, textTransform: "uppercase" }}>
          {(scene.headline || "Metric pressure.").split(/\s+/).slice(0, 6).join(" ")}
        </h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20, marginTop: 34 }}>
          {bars.map((keyword, index) => {
            const width = interpolate(frame, [0, 60], [15, 65 + index * 8], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div key={keyword} style={{ padding: 24, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(7,12,28,0.44)", borderRadius: 28, backdropFilter: "blur(12px)" }}>
                <div style={{ fontSize: 22, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(226,232,240,0.65)" }}>{keyword}</div>
                <AnimatedCounter
                  transition={{ values: [0, Math.round(width)], duration: 52 }}
                  postfix="%"
                  style={{ fontSize: 78, marginTop: 18, fontWeight: 800, display: "block" }}
                />
                <div style={{ marginTop: 18, height: 12, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                  <div style={{ width: `${width}%`, height: "100%", borderRadius: 999, background: palette[(index + 1) % palette.length] }} />
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ marginTop: "auto", maxWidth: 620, fontSize: 28, color: "rgba(226,232,240,0.72)" }}>{scene.subhead || scene.visualIntent}</p>
      </div>
    </SceneFrame>
  );
}

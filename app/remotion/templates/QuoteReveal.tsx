import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DataBadge } from "../primitives/DataBadge";
import { SceneFrame } from "../primitives/SceneFrame";
import type { ScenePlan } from "@/app/lib/videoPlan/types";

export function QuoteReveal({ scene, palette }: { scene: ScenePlan; palette: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fragments = (scene.voiceText || scene.headline || "").split(/[,.;:!?]/).map((part) => part.trim()).filter(Boolean).slice(0, 3);

  return (
    <SceneFrame palette={palette} accentIndex={4}>
      <div style={{ position: "absolute", inset: 86, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <DataBadge label="Key Line" accent="#ec4899" />
          {fragments.map((fragment, index) => {
            const progress = spring({
              frame: frame - index * 10,
              fps,
              config: { damping: 16, stiffness: 90 },
            });

            return (
              <div
                key={`${fragment}-${index}`}
                style={{
                  marginTop: 26,
                  opacity: progress,
                  transform: `translateX(${(1 - progress) * 80}px)`,
                  fontSize: index === 0 ? 112 : 66,
                  lineHeight: 0.88,
                  color: index === 1 ? palette[4] : "#f8fafc",
                  maxWidth: 820,
                  textTransform: "uppercase",
                }}
              >
                {fragment}
              </div>
            );
          })}
        </div>
        <p style={{ maxWidth: 640, fontSize: 28, color: "rgba(226,232,240,0.68)" }}>{scene.visualIntent}</p>
      </div>
    </SceneFrame>
  );
}

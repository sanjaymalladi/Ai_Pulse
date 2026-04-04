import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { DataBadge } from "../primitives/DataBadge";
import { SceneFrame } from "../primitives/SceneFrame";
import type { ScenePlan } from "@/app/lib/videoPlan/types";

export function DiagramFlow({ scene, palette }: { scene: ScenePlan; palette: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const steps = [scene.headline || "Input", ...scene.keywords].slice(0, 4);

  return (
    <SceneFrame palette={palette} accentIndex={1}>
      <div style={{ position: "absolute", inset: 54, display: "flex", flexDirection: "column" }}>
        <DataBadge label="System Flow" />
        <div style={{ position: "relative", flex: 1, marginTop: 30 }}>
          {steps.map((step, index) => {
            const progress = spring({
              frame: frame - index * 8,
              fps,
              config: { damping: 18, stiffness: 90 },
            });
            const left = 90 + index * 190;
            const top = index % 2 === 0 ? 120 : 360;

            return (
              <React.Fragment key={`${step}-${index}`}>
                <div
                  style={{
                    position: "absolute",
                    left,
                    top,
                    width: 270,
                    minHeight: 140,
                    padding: 24,
                    borderRadius: 26,
                    border: "1px solid rgba(148,163,184,0.28)",
                    background: "rgba(8,15,29,0.72)",
                    boxShadow: "0 28px 64px rgba(2,6,23,0.34)",
                    transform: `scale(${0.8 + progress * 0.2})`,
                    opacity: progress,
                    backdropFilter: "blur(12px)",
                  }}
                >
                  <div style={{ fontSize: 18, letterSpacing: "0.18em", textTransform: "uppercase", color: palette[(index + 2) % palette.length] }}>
                    Stage {index + 1}
                  </div>
                  <div style={{ marginTop: 16, fontSize: 44, lineHeight: 0.92, color: "#f8fafc", textTransform: "uppercase" }}>{step}</div>
                </div>
                {index < steps.length - 1 ? (
                  <div
                    style={{
                      position: "absolute",
                      left: left + 250,
                      top: top + 54,
                      width: 130,
                      height: 2,
                      background: palette[(index + 1) % palette.length],
                      transform: `scaleX(${progress})`,
                      transformOrigin: "left center",
                    }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
        <p style={{ fontSize: 26, color: "rgba(226,232,240,0.72)", maxWidth: 640 }}>{scene.subhead || scene.voiceText}</p>
      </div>
    </SceneFrame>
  );
}

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SceneFrame } from "../primitives/SceneFrame";
import type { ScenePlan } from "@/app/lib/videoPlan/types";

export function AmbientTransitionBridge({ scene, palette }: { scene: ScenePlan; palette: string[] }) {
  const frame = useCurrentFrame();
  const shift = interpolate(frame, [0, 90], [-200, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame palette={palette} accentIndex={5}>
      <div style={{ position: "absolute", inset: 0 }}>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: 120 + index * 240 + shift * (index % 2 === 0 ? 0.12 : -0.08),
              top: 220 + index * 180,
              width: 320,
              height: 180,
              borderRadius: 40,
              border: `1px solid ${palette[index % palette.length]}`,
              background: "rgba(9,17,31,0.36)",
              boxShadow: "0 28px 60px rgba(2,6,23,0.26)",
              backdropFilter: "blur(16px)",
              transform: `rotate(${index % 2 === 0 ? 12 : -12}deg)`,
            }}
          />
        ))}
        <div style={{ position: "absolute", left: 90, right: 90, bottom: 180 }}>
          <div style={{ fontSize: 138, lineHeight: 0.8, maxWidth: 860, textTransform: "uppercase", color: "#f8fafc" }}>
            {(scene.headline || scene.visualIntent).split(/\s+/).slice(0, 6).join(" ")}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AnimatedText } from "remotion-bits";
import { SceneFrame } from "../primitives/SceneFrame";
import type { ScenePlan } from "@/app/lib/videoPlan/types";

export function KineticTypography({ scene, palette }: { scene: ScenePlan; palette: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = (scene.headline || scene.voiceText).split(/\s+/).slice(0, 5);

  return (
    <SceneFrame palette={palette} accentIndex={0}>
      <div style={{ position: "absolute", inset: 54, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <span style={{ fontSize: 22, letterSpacing: "0.22em", color: "rgba(226,232,240,0.55)", textTransform: "uppercase" }}>
            SIGNAL BURST
          </span>
          <span style={{ fontSize: 18, color: palette[1], letterSpacing: "0.18em", textTransform: "uppercase" }}>
            {scene.motionLevel}
          </span>
        </div>
        {beats.map((word, index) => {
          const delay = index * 4;
          const progress = spring({
            frame: frame - delay,
            fps,
            config: { damping: 15, stiffness: 120, mass: 0.6 },
          });
          const x = interpolate(progress, [0, 1], [100, 0]);
          const scale = interpolate(progress, [0, 1], [0.92, 1]);
          return (
            <AnimatedText
              key={`${word}-${index}`}
              transition={{ y: [28, 0], opacity: [0, 1], duration: 18, split: "character", splitStagger: 1 }}
              style={{
                fontSize: 190 - index * 16,
                textTransform: "uppercase",
                fontWeight: 800,
                lineHeight: 0.78,
                transform: `translate3d(${x}px, ${Math.sin((frame + index * 10) * 0.04) * 10}px, 0) scale(${scale})`,
                opacity: progress,
                color: index % 2 === 0 ? "#f8fafc" : palette[(index + 1) % palette.length],
                textShadow: "0 20px 48px rgba(2,6,23,0.42)",
              }}
            >
              {word}
            </AnimatedText>
          );
        })}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <p style={{ maxWidth: 560, fontSize: 28, color: "rgba(226,232,240,0.72)", fontFamily: '"Space Mono", monospace' }}>
            {scene.subhead || scene.visualIntent}
          </p>
          <div style={{ width: 260, height: 140, position: "relative", opacity: 0.9 }}>
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                style={{
                  position: "absolute",
                  left: row * 24,
                  right: 0,
                  top: row * 24,
                  height: 2,
                  background: `linear-gradient(90deg, ${palette[(row + 1) % palette.length]}, transparent)`,
                  transform: `scaleX(${0.4 + ((frame + row * 7) % 40) / 60})`,
                  transformOrigin: "left center",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

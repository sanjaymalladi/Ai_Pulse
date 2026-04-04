import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AnimatedText } from "remotion-bits";
import { DataBadge } from "../primitives/DataBadge";
import { MediaLayer } from "../primitives/MediaLayer";
import { SceneFrame } from "../primitives/SceneFrame";
import type { ScenePlan } from "@/app/lib/videoPlan/types";

export function HeroLogoStatement({ scene, palette }: { scene: ScenePlan; palette: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 18, stiffness: 90 } });
  const media = scene.resolvedAssets.find((asset) => asset.kind === "logo" || asset.kind === "image");
  const slide = interpolate(progress, [0, 1], [140, 0]);

  return (
    <SceneFrame palette={palette} accentIndex={1}>
      <div style={{ position: "absolute", inset: 54, display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 30 }}>
        <div
          style={{
            transform: `translateX(${-slide}px) scale(${0.96 + progress * 0.04})`,
            borderRadius: 44,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "rgba(7,12,28,0.64)",
            padding: 22,
            boxShadow: "0 30px 90px rgba(0,0,0,0.42)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, rgba(167,255,90,0.10), transparent 34%), linear-gradient(330deg, rgba(125,211,252,0.08), transparent 40%)",
            }}
          />
          <MediaLayer asset={media} rounded={30} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "24px 0" }}>
          <div style={{ transform: `translateY(${slide * 0.5}px)`, opacity: progress }}>
            <DataBadge label={scene.template.replaceAll("_", " ")} />
            <AnimatedText
              transition={{ split: "word", splitStagger: 4, y: [32, 0], opacity: [0, 1], duration: 36 }}
              style={{ display: "block", fontSize: 128, lineHeight: 0.84, marginTop: 24, textTransform: "uppercase", letterSpacing: "-0.05em", maxWidth: 520 }}
            >
              {(scene.headline || scene.voiceText.slice(0, 48)).split(/\s+/).slice(0, 7).join(" ")}
            </AnimatedText>
            <p style={{ marginTop: 16, maxWidth: 460, fontSize: 28, color: "rgba(226,232,240,0.74)", lineHeight: 1.3, fontFamily: '"Space Mono", monospace' }}>
              {scene.subhead || scene.visualIntent}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", maxWidth: 520 }}>
            {scene.keywords.slice(0, 3).map((keyword) => (
              <DataBadge key={keyword} label={keyword} accent={keyword.length % 2 === 0 ? "#7dd3fc" : "#a7ff5a"} />
            ))}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
}

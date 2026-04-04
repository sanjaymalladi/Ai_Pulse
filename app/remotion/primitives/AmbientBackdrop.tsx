import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GradientTransition } from "remotion-bits";

export function AmbientBackdrop({ palette, accentIndex }: { palette: string[]; accentIndex: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = spring({ frame, fps, config: { damping: 18, stiffness: 70 } });
  const drift = interpolate(frame, [0, 180], [-80, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const colorA = palette[accentIndex % palette.length] || "#a7ff5a";
  const colorB = palette[(accentIndex + 1) % palette.length] || "#7dd3fc";
  const colorC = palette[(accentIndex + 2) % palette.length] || "#ff8fab";

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#07111f" }}>
      <GradientTransition
        gradient={[
          "linear-gradient(135deg, #050816 0%, #0b1730 48%, #081120 100%)",
          "linear-gradient(135deg, #070d18 0%, #0d1b34 36%, #140f2b 100%)",
          "linear-gradient(135deg, #030712 0%, #091426 42%, #101a30 100%)",
        ]}
        duration={180}
        style={{ position: "absolute", inset: 0 }}
      />
      <div
        style={{
          position: "absolute",
          inset: -180,
          background: `radial-gradient(circle at 20% 20%, ${colorA}42 0%, transparent 34%),
            radial-gradient(circle at 80% 30%, ${colorB}38 0%, transparent 28%),
            radial-gradient(circle at 45% 70%, ${colorC}32 0%, transparent 34%)`,
          filter: "blur(18px)",
          transform: `translate3d(${drift}px, ${Math.sin(frame * 0.02) * 24}px, 0) scale(${1 + pulse * 0.04})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.14) 1px, transparent 1px)",
          backgroundSize: "84px 84px",
          opacity: 0.16,
          transform: `perspective(1000px) rotateX(70deg) translateY(${200 - pulse * 40}px) scale(1.4)`,
          transformOrigin: "center top",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at center, transparent 0%, rgba(3,7,18,0.08) 48%, rgba(3,7,18,0.54) 100%)",
        }}
      />
    </div>
  );
}

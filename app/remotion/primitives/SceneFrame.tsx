import React, { PropsWithChildren } from "react";
import { AmbientBackdrop } from "./AmbientBackdrop";

export function SceneFrame({
  palette,
  accentIndex,
  children,
}: PropsWithChildren<{ palette: string[]; accentIndex: number }>) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        color: "#f8fafc",
        fontFamily: '"Syne", "Segoe UI", sans-serif',
      }}
    >
      <AmbientBackdrop palette={palette} accentIndex={accentIndex} />
      <div
        style={{
          position: "absolute",
          inset: 20,
          border: "1px solid rgba(148,163,184,0.16)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04) inset",
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}

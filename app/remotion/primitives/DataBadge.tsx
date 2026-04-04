import React from "react";

export function DataBadge({ label, accent = "#a7ff5a" }: { label: string; accent?: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        border: `1px solid ${accent}`,
        background: "rgba(9,17,31,0.62)",
        color: "#f8fafc",
        backdropFilter: "blur(14px)",
        boxShadow: "0 18px 48px rgba(2, 6, 23, 0.28)",
        fontSize: 24,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: accent,
          boxShadow: `0 0 18px ${accent}55`,
        }}
      />
      {label}
    </div>
  );
}

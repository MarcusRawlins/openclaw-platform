"use client";
import React from "react";

const colors: Record<string, string> = {
  LEAD: "var(--accent-blue)",
  CLIENT: "var(--accent-green)",
  VENDOR: "var(--accent-purple)",
  OTHER: "var(--text-muted)",
};

export default function Badge({ type }: { type: string }) {
  const color = colors[type] || colors.OTHER;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
      }}
    >
      {type}
    </span>
  );
}

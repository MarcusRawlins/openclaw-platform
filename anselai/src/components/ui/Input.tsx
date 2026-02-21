"use client";
import React from "react";

export default function Input({
  label,
  style,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</label>}
      <input
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          fontSize: 14,
          outline: "none",
          ...style,
        }}
        {...props}
      />
    </div>
  );
}

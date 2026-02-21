"use client";
import React from "react";

type Variant = "primary" | "secondary" | "danger";

const styles: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--accent-blue)", color: "#fff" },
  secondary: { background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)" },
  danger: { background: "var(--accent-red)", color: "#fff" },
};

export default function Button({
  variant = "primary",
  children,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        fontWeight: 500,
        fontSize: 14,
        ...styles[variant],
        opacity: props.disabled ? 0.5 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

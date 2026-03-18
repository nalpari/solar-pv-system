"use client";

import { Sun } from "lucide-react";

export default function Header() {
  return (
    <header
      style={{
        height: 56,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--accent-orange-muted), var(--accent-green-muted))",
            border: "1px solid var(--border-secondary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sun size={18} color="var(--accent-orange)" />
        </div>
        <div>
          <h1
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            Solar PV Planner
          </h1>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              lineHeight: 1.2,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            Rooftop Panel Layout Designer
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-tertiary)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--accent-green)",
              display: "inline-block",
            }}
          />
          System Ready
        </div>
      </div>
    </header>
  );
}

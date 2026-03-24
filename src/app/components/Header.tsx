"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  return (
    <header
      style={{
        height: 56,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px",
        flexShrink: 0,
      }}
    >
      <div
        onClick={() => router.push("/")}
        style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
      >
        <Image
          src="/hanwha.png"
          alt="Hanwha Japan"
          width={160}
          height={32}
          style={{ height: 28, width: "auto" }}
          priority
        />
      </div>
      {/* TODO: System Ready 상태 표시 복원 */}
    </header>
  );
}

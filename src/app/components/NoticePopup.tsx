"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};

// 공지 문구가 바뀌면 이 키를 바꿔서 기존 "2주 숨김"을 초기화한다.
const STORAGE_KEY = "pvmap-notice-until";
const HIDE_MS = 14 * 24 * 60 * 60 * 1000;

// UI 는 일본어 고정(`<html lang="ja">`) — 일회성 공지라 i18n 테이블에 넣지 않는다.
const BODY = [
  "PVMapをご利用いただき、誠にありがとうございます。",
  "現在、先行公開期間として、屋根面のマニュアル作図機能を優先公開中です。",
  "今後、皆様からいただいたご意見・ご要望を踏まえ、作図機能の拡充・強化を進めるとともに、新たな運用形態へ移行する予定です。",
  "今後の運用や詳細につきましては、決まり次第、改めてご案内いたします。",
  "引き続き、PVMapをご活用くださいますよう、よろしくお願いいたします。",
];

// 숨김 만료시각이 지났는지 — 스토리지 차단 환경에서는 매번 노출한다.
function isNoticeDue() {
  try {
    return Date.now() >= (Number(localStorage.getItem(STORAGE_KEY)) || 0);
  } catch {
    return true;
  }
}

export default function NoticePopup() {
  const [dismissed, setDismissed] = useState(false);
  const [hideForTwoWeeks, setHideForTwoWeeks] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // SSR/하이드레이션 시점엔 false — 마운트 후에만 만료시각을 읽는다 (tip-popover 와 동일 패턴)
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const open = mounted && !dismissed && isNoticeDue();

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const close = () => {
    if (hideForTwoWeeks) {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now() + HIDE_MS));
      } catch {
        /* 저장 불가 환경 — 다음 로딩에 다시 노출 */
      }
    }
    setDismissed(true);
  };

  // 포커스는 카드 안(체크박스 ↔ 閉じる)에서만 순환시킨다.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const items = cardRef.current?.querySelectorAll<HTMLElement>("input, button");
    if (!items?.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      data-notice
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(24, 30, 40, 0.55)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "noticeFade 200ms ease-out",
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notice-salutation"
        data-notice
        style={{
          width: "100%",
          maxWidth: 560,
          background: "var(--bg-elevated)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
          fontFamily: '"Noto Sans JP", var(--font-noto-sans-jp), system-ui, sans-serif',
          animation: "noticeRise 260ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {/* 레터헤드 — 로고 + 先行公開中 스탬프, 그 아래 한화 블루 룰 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "22px 32px 18px",
          }}
        >
          <Image
            src="/assets/images/common/pv_new_logo.svg"
            alt="PVMap"
            width={148}
            height={30}
            priority
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "var(--accent-orange)",
              border: "1px solid var(--accent-orange)",
              borderRadius: 999,
              padding: "4px 10px",
              whiteSpace: "nowrap",
            }}
          >
            先行公開中
          </span>
        </div>
        <div style={{ height: 2, background: "var(--accent-blue)" }} />

        <div style={{ padding: "26px 32px 24px" }}>
          <p
            id="notice-salutation"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "var(--text-primary)",
            }}
          >
            お取引様各位
          </p>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            {BODY.map((line) => (
              <p
                key={line}
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  lineHeight: 2,
                  color: "var(--text-secondary)",
                }}
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "16px 32px 22px",
            borderTop: "1px solid var(--border-secondary)",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--text-secondary)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={hideForTwoWeeks}
              onChange={(e) => setHideForTwoWeeks(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "var(--accent-blue)",
                cursor: "pointer",
              }}
            />
            このメッセージを2週間表示しない
          </label>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            style={{
              padding: "9px 26px",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              color: "var(--text-inverse)",
              background: "var(--accent-blue)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-blue-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent-blue)";
            }}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

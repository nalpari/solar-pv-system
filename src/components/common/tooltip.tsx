import type { ReactNode } from "react";

type TooltipProps = {
  /** 호버 시 표시할 안내문구. 없으면 툴팁 없이 children 만 렌더 */
  text?: string;
  children: ReactNode;
  /** 래퍼에 적용할 클래스 (레이아웃용 — flex-1 / w-full 등) */
  className?: string;
  /** 툴팁 표시 방향. 기본 "bottom"(아래). 스크롤 하단 고정 요소는 "top"(위) 지정. */
  placement?: "top" | "bottom";
};

/**
 * 호버 시 검정 반투명 말풍선을 띄우는 툴팁 래퍼.
 * 디자인은 크롭 안내 배너(MapView)와 통일 — rgba(0,0,0,0.7) 배경 + 흰 글씨 + 둥근 모서리.
 * 여백은 배너(8px 20px)보다 작게(4px 10px) 잡아 툴팁에 맞춘다.
 *
 * 방향은 호출부에서 placement 로 지정한다 — 스크롤 영역 요소는 기본(아래), 스크롤 밖
 * 하단 고정 버튼은 "top"(위)로 지정해 잘림을 피한다.
 *
 * disabled 요소를 감싸도 래퍼(span)에 hover 가 걸리므로 툴팁이 정상 표시된다
 * (disabled 자식은 pointer-events 를 꺼서 hover 를 래퍼로 넘기는 것을 권장).
 */
export function Tooltip({ text, children, className, placement = "bottom" }: TooltipProps) {
  if (!text) {
    return <span className={`inline-flex ${className ?? ""}`}>{children}</span>;
  }
  return (
    <span className={`group/tooltip relative inline-flex ${className ?? ""}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-black/70 px-2.5 py-1 text-[12px] font-medium leading-[1.4] text-white opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100 ${
          placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

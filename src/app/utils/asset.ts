// 정적 자산(public/) 경로에 basePath 를 prefix 한다.
// next/image 등은 string src 에 basePath 를 자동 적용하지 않으므로(정적 import 만 자동),
// public 자산을 절대경로로 참조할 때는 이 헬퍼로 감싸 NEXT_PUBLIC_BASE_PATH 를 붙인다.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}

import { redirect } from "next/navigation";

// next.config.ts의 redirects()가 먼저 처리하지만, 클라이언트 내비게이션 등
// 리다이렉트를 안 타는 경로를 위한 폴백.
// (기존: 클라이언트에서 /api/debug → /api/seed 순차 호출 후 이동 → 첫 화면까지 수 초 지연.
//  시드는 이미 완료됐고 /api/seed는 필요 시 수동 호출로 유지.)
export default function HomePage() {
  redirect("/group/main");
}

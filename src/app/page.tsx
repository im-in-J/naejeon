"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [status, setStatus] = useState("로딩 중...");

  useEffect(() => {
    async function init() {
      // Supabase를 서버 API를 통해 확인
      const res = await fetch("/api/debug");
      const debug = await res.json();

      if (debug.db !== "CONNECTED") {
        setStatus("DB 연결 실패. 환경변수를 확인해주세요.");
        return;
      }

      // 매치 존재 여부 확인 후 시드 또는 이동
      const seedRes = await fetch("/api/seed");
      const seedData = await seedRes.json();

      if (seedData.success) {
        router.replace("/group/main");
      } else {
        setStatus(seedData.error || "초기화 실패");
      }
    }

    init().catch((err) => {
      console.error(err);
      setStatus(`에러: ${err.message}`);
    });
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-ink-subtle text-sm">{status}</p>
      </div>
    </div>
  );
}

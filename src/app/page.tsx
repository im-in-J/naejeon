"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAllGroups, importGroup } from "@/lib/store";
import { importNaejeonData } from "@/lib/import-naejeon";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // 자동으로 컴학내전 데이터 로드 후 그룹 페이지로 이동
    const groups = getAllGroups();
    if (groups.length > 0) {
      router.replace(`/group/${groups[0].id}`);
    } else {
      const { groupName, matches } = importNaejeonData();
      const group = importGroup(groupName, matches);
      router.replace(`/group/${group.id}`);
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-text-muted text-sm">로딩 중...</p>
      </div>
    </div>
  );
}

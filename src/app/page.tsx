"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { importNaejeonData } from "@/lib/import-naejeon";
import { calculateMvpScores } from "@/lib/mvp";

export default function HomePage() {
  const router = useRouter();
  const [status, setStatus] = useState("로딩 중...");

  useEffect(() => {
    async function init() {
      // Check if matches exist in DB
      const { count } = await getSupabase()
        .from("matches")
        .select("*", { count: "exact", head: true });

      if (count && count > 0) {
        router.replace("/group/main");
        return;
      }

      // Seed initial data from imported JSON
      setStatus("초기 데이터 세팅 중...");
      const { matches } = importNaejeonData();

      for (const match of matches) {
        await getSupabase().from("matches").insert({
          id: match.id,
          group_name: "컴학내전",
          created_at: match.createdAt,
          game_duration: match.gameDuration,
          players: match.players,
        });
      }

      // Register members from match data
      const nicknames = new Set<string>();
      for (const m of matches) {
        for (const p of m.players) {
          nicknames.add(p.nickname);
        }
      }

      const members = Array.from(nicknames).map((nickname) => ({ nickname }));
      await getSupabase().from("members").upsert(members, { onConflict: "nickname" });

      router.replace("/group/main");
    }

    init().catch((err) => {
      console.error(err);
      setStatus("DB 연결 실패. 환경변수를 확인해주세요.");
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

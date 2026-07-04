import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import importedData from "@/lib/imported-data.json";
import { calculateMvpScores } from "@/lib/mvp";
import type { PlayerStat } from "@/lib/types";

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json({ success: false, error: "환경변수 미설정" });
    }

    const supabase = createClient(url, key);

    // Check if data already exists
    const { count } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      return NextResponse.json({ success: true, message: "이미 데이터 존재", count });
    }

    // Seed from imported data
    const rawMatches = importedData as Array<{
      id: string;
      played_at: string;
      created_at: string;
      duration: string;
      team1_data: { result: string; players: Array<{ name: string; champion: string; lane: string; kills: number; deaths: number; assists: number; cs: number; gold: number }> };
      team2_data: { result: string; players: Array<{ name: string; champion: string; lane: string; kills: number; deaths: number; assists: number; cs: number; gold: number }> };
    }>;

    const nicknames = new Set<string>();

    for (const m of rawMatches) {
      const team1Win = m.team1_data.result === "승리";

      const allPlayers: PlayerStat[] = [
        ...m.team1_data.players.map((p, i) => ({
          id: `t1-${i}`, matchId: m.id, nickname: p.name, champion: p.champion,
          lane: p.lane as PlayerStat["lane"], team: "blue" as const, win: team1Win,
          kills: p.kills, deaths: p.deaths, assists: p.assists, cs: p.cs, gold: p.gold,
          damageDealt: 0, damageTaken: 0, visionScore: 0, wardsPlaced: 0, wardsDestroyed: 0,
          objectiveDamage: 0, ccScore: 0, healingDone: 0, shieldingDone: 0,
          killParticipation: 0, mvpScore: 0, isMvp: false, isAce: false,
        })),
        ...m.team2_data.players.map((p, i) => ({
          id: `t2-${i}`, matchId: m.id, nickname: p.name, champion: p.champion,
          lane: p.lane as PlayerStat["lane"], team: "red" as const, win: !team1Win,
          kills: p.kills, deaths: p.deaths, assists: p.assists, cs: p.cs, gold: p.gold,
          damageDealt: 0, damageTaken: 0, visionScore: 0, wardsPlaced: 0, wardsDestroyed: 0,
          objectiveDamage: 0, ccScore: 0, healingDone: 0, shieldingDone: 0,
          killParticipation: 0, mvpScore: 0, isMvp: false, isAce: false,
        })),
      ];

      const scored = calculateMvpScores(allPlayers);

      for (const p of scored) nicknames.add(p.nickname);

      await supabase.from("matches").insert({
        id: m.id,
        group_name: "컴학내전",
        created_at: m.created_at || m.played_at,
        game_duration: m.duration,
        players: scored,
      });
    }

    // Insert members
    const members = Array.from(nicknames).map((nickname) => ({ nickname }));
    await supabase.from("members").upsert(members, { onConflict: "nickname" });

    return NextResponse.json({
      success: true,
      message: "시드 완료",
      matches: rawMatches.length,
      members: members.length,
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

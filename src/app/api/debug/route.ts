import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const envCheck = {
    hasUrl: !!url,
    urlPrefix: url ? url.substring(0, 30) + "..." : "NOT SET",
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 20) + "..." : "NOT SET",
    uploadSecret: !!process.env.UPLOAD_SECRET,
  };

  if (!url || !key) {
    return NextResponse.json({ ...envCheck, db: "ENV NOT SET" });
  }

  try {
    const supabase = createClient(url, key);

    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: true });

    const { data: members, error: memberErr } = await supabase
      .from("members")
      .select("*");

    // 데이터 무결성 리포트 (재수집 후 점검용)
    type P = { nickname?: string; champion?: string; lane?: string; win?: boolean };
    const rows = matches || [];
    const allPlayers = rows.flatMap((m) => (m.players as P[]) || []);
    const laneCount = new Map<string, number>();
    const playerGames = new Map<string, number>();
    for (const p of allPlayers) {
      laneCount.set(p.lane || "(없음)", (laneCount.get(p.lane || "(없음)") || 0) + 1);
      const nick = p.nickname || "(없음)";
      playerGames.set(nick, (playerGames.get(nick) || 0) + 1);
    }
    const report = {
      matches: rows.length,
      dateRange: rows.length
        ? { first: rows[0].created_at, last: rows[rows.length - 1].created_at }
        : null,
      withGameId: rows.filter((m) => m.game_id).length,
      withBans: rows.filter((m) => m.bans && ((m.bans.blue || []).length || (m.bans.red || []).length)).length,
      not10Players: rows
        .filter((m) => ((m.players as P[]) || []).length !== 10)
        .map((m) => ({ id: m.id, created_at: m.created_at, players: ((m.players as P[]) || []).length })),
      laneDistribution: Object.fromEntries(laneCount),
      playerNRemnants: allPlayers.filter((p) => /^Player([1-9]|10)$/.test(p.nickname || "")).length,
      englishChampions: [...new Set(allPlayers.map((p) => p.champion || "").filter((c) => /^[A-Za-z]/.test(c)))],
      uniquePlayers: playerGames.size,
      gamesPerPlayer: Object.fromEntries([...playerGames.entries()].sort((a, b) => b[1] - a[1])),
      members: (members || []).map((m) => ({
        nickname: m.nickname,
        aliases: m.aliases || [],
        tier: m.tier || null,
        lanes: m.preferred_lanes || [],
        realName: m.real_name ? "설정됨" : null,
      })),
    };

    return NextResponse.json({
      ...envCheck,
      db: "CONNECTED",
      matchesTable: matchErr ? { error: matchErr.message, code: matchErr.code } : "OK",
      membersTable: memberErr ? { error: memberErr.message, code: memberErr.code } : "OK",
      report,
    });
  } catch (err) {
    return NextResponse.json({
      ...envCheck,
      db: "CONNECTION_FAILED",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

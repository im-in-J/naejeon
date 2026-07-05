import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateMvpScores } from "@/lib/mvp";
import { v4 as uuid } from "uuid";
import type { PlayerStat } from "@/lib/types";

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || "naejeon-upload-2024";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { secret, match } = body;

    if (secret !== UPLOAD_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!match || !match.players || match.players.length === 0) {
      return NextResponse.json(
        { error: "Invalid match data", received: { hasMatch: !!match, playerCount: match?.players?.length } },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "서버 환경변수 미설정 (SUPABASE_URL 또는 ANON_KEY)" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 같은 게임 중복 업로드 방지 (game_id 컬럼이 없는 구버전 DB면 조용히 건너뜀)
    const gameId = match.gameId != null ? String(match.gameId) : null;
    if (gameId) {
      const { data: dup, error: dupError } = await supabase
        .from("matches")
        .select("id")
        .eq("game_id", gameId)
        .limit(1);

      if (!dupError && dup && dup.length > 0) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          matchId: dup[0].id,
        });
      }
    }

    // Build player stats
    const players: PlayerStat[] = match.players.map((p: Record<string, unknown>, i: number) => ({
      id: `p-${i}`,
      matchId: "",
      nickname: String(p.nickname || `Player${i + 1}`),
      champion: String(p.champion || ""),
      lane: p.lane || undefined,
      team: p.team || (i < 5 ? "blue" : "red"),
      win: Boolean(p.win),
      kills: Number(p.kills) || 0,
      deaths: Number(p.deaths) || 0,
      assists: Number(p.assists) || 0,
      cs: Number(p.cs) || 0,
      gold: Number(p.gold) || 0,
      damageDealt: Number(p.damageDealt) || 0,
      damageTaken: Number(p.damageTaken) || 0,
      visionScore: Number(p.visionScore) || 0,
      wardsPlaced: Number(p.wardsPlaced) || 0,
      wardsDestroyed: Number(p.wardsDestroyed) || 0,
      objectiveDamage: Number(p.objectiveDamage) || 0,
      ccScore: Number(p.ccScore) || 0,
      healingDone: Number(p.healingDone) || 0,
      shieldingDone: Number(p.shieldingDone) || 0,
      killParticipation: 0,
      mvpScore: 0,
      isMvp: false,
      isAce: false,
    }));

    const scored = calculateMvpScores(players);
    const matchId = uuid();

    const row: Record<string, unknown> = {
      id: matchId,
      group_name: "컴학내전",
      game_duration: match.gameDuration || "",
      game_mode: match.gameMode || "rift",
      players: scored,
    };
    if (gameId) row.game_id = gameId;

    let { error: insertError } = await supabase.from("matches").insert(row);

    // game_id 컬럼이 없는 구버전 DB → 컬럼 빼고 재시도
    if (insertError && gameId && /game_id/.test(insertError.message)) {
      delete row.game_id;
      ({ error: insertError } = await supabase.from("matches").insert(row));
    }

    if (insertError) {
      console.error("DB insert error:", insertError);
      return NextResponse.json(
        { error: "DB 저장 실패", detail: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }

    // Auto-register new members (ignore errors)
    const { data: existing } = await supabase.from("members").select("nickname");
    const existingSet = new Set((existing || []).map((m) => m.nickname));

    const newMembers = scored
      .filter((p) => !existingSet.has(p.nickname))
      .map((p) => ({ nickname: p.nickname }));

    if (newMembers.length > 0) {
      await supabase.from("members").upsert(newMembers, { onConflict: "nickname" });
    }

    console.log(`Match uploaded: ${matchId}, ${scored.length} players, ${match.gameDuration}`);

    return NextResponse.json({
      success: true,
      matchId,
      players: scored.length,
      duration: match.gameDuration,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

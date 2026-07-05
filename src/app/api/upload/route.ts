import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateMvpScores } from "@/lib/mvp";
import { normalizeChampionName } from "@/lib/champions";
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

    // 같은 게임이 이미 있으면 덮어쓰기 대상으로 기록 (game_id 컬럼 없는 구버전 DB면 조용히 건너뜀)
    const gameId = match.gameId != null ? String(match.gameId) : null;
    let existingId: string | null = null;
    if (gameId) {
      const { data: dup, error: dupError } = await supabase
        .from("matches")
        .select("id")
        .eq("game_id", gameId)
        .limit(1);
      if (!dupError && dup && dup.length > 0) existingId = dup[0].id;
    }

    // 실제 게임 시작 시각 (epoch ms) — 과거 경기가 업로드 시점 날짜로 기록되지 않도록
    const creationMs = Number(match.gameCreation);
    const gameCreation =
      Number.isFinite(creationMs) && creationMs > 946684800000 // 2000-01-01 이후만 신뢰
        ? new Date(creationMs).toISOString()
        : null;

    // 부캐 닉네임 → 본캐 닉네임 매핑 (아이디 통합이 새 업로드에도 유지되도록)
    const { data: memberRows } = await supabase
      .from("members")
      .select("nickname, aliases");
    const aliasMap = new Map<string, string>();
    for (const m of memberRows || []) {
      for (const a of (m.aliases as string[]) || []) {
        aliasMap.set(a, m.nickname);
      }
    }

    // Build player stats (덮어쓰기면 기존 매치 id 유지)
    const matchId = existingId || uuid();
    const players: PlayerStat[] = match.players.map((p: Record<string, unknown>, i: number) => {
      const rawNickname = String(p.nickname || `Player${i + 1}`);
      return {
      id: `p-${i}`,
      matchId,
      nickname: aliasMap.get(rawNickname) || rawNickname,
      champion: normalizeChampionName(String(p.champion || "")),
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
      turretDamage: Number(p.turretDamage) || 0,
      firstBlood: Boolean(p.firstBlood),
      largestMultiKill: Number(p.largestMultiKill) || 0,
      killParticipation: 0,
      mvpScore: 0,
      isMvp: false,
      isAce: false,
      };
    });

    const scored = calculateMvpScores(players);

    const row: Record<string, unknown> = {
      group_name: "컴학내전",
      game_duration: match.gameDuration || "",
      game_mode: match.gameMode || "rift",
      players: scored,
    };
    if (gameId) row.game_id = gameId;
    if (gameCreation) row.created_at = gameCreation;
    if (match.bans && (match.bans.blue?.length || match.bans.red?.length)) {
      row.bans = {
        blue: (match.bans.blue || []).map((c: string) => normalizeChampionName(String(c))),
        red: (match.bans.red || []).map((c: string) => normalizeChampionName(String(c))),
      };
    }

    const save = async () => {
      if (existingId) {
        // 이미 등록된 게임 → 날짜·스탯·밴 덮어쓰기
        return supabase.from("matches").update(row).eq("id", matchId);
      }
      return supabase.from("matches").insert({ ...row, id: matchId });
    };

    let { error: insertError } = await save();

    // 마이그레이션 안 된 구버전 DB → 없는 컬럼 빼고 재시도
    for (const optionalCol of ["bans", "game_id"]) {
      if (insertError && optionalCol in row && insertError.message.includes(optionalCol)) {
        delete row[optionalCol];
        ({ error: insertError } = await save());
      }
    }

    if (insertError) {
      console.error("DB insert error:", insertError);
      return NextResponse.json(
        { error: "DB 저장 실패", detail: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }

    // Auto-register new members (ignore errors)
    const existingSet = new Set((memberRows || []).map((m) => m.nickname));

    const newMembers = scored
      .filter((p) => !existingSet.has(p.nickname))
      .map((p) => ({ nickname: p.nickname }));

    if (newMembers.length > 0) {
      await supabase.from("members").upsert(newMembers, { onConflict: "nickname" });
    }

    console.log(`Match ${existingId ? "updated" : "uploaded"}: ${matchId}, ${scored.length} players, ${match.gameDuration}`);

    return NextResponse.json({
      success: true,
      matchId,
      updated: !!existingId,
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

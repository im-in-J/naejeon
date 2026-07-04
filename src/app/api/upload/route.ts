import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateMvpScores } from "@/lib/mvp";
import { v4 as uuid } from "uuid";
import type { PlayerStat } from "@/lib/types";

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || "naejeon-upload-2024";

export async function POST(req: NextRequest) {
  try {
    const { secret, match } = await req.json();

    if (secret !== UPLOAD_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!match || !match.players || match.players.length === 0) {
      return NextResponse.json({ error: "Invalid match data" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    );

    // Build player stats
    const players: PlayerStat[] = match.players.map((p: Record<string, unknown>, i: number) => ({
      id: `p-${i}`,
      matchId: "",
      nickname: p.nickname || "",
      champion: p.champion || "",
      lane: p.lane || undefined,
      team: p.team || (i < 5 ? "blue" : "red"),
      win: p.win ?? false,
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      cs: p.cs ?? 0,
      gold: p.gold ?? 0,
      damageDealt: p.damageDealt ?? 0,
      damageTaken: p.damageTaken ?? 0,
      visionScore: p.visionScore ?? 0,
      wardsPlaced: p.wardsPlaced ?? 0,
      wardsDestroyed: p.wardsDestroyed ?? 0,
      objectiveDamage: p.objectiveDamage ?? 0,
      ccScore: p.ccScore ?? 0,
      healingDone: p.healingDone ?? 0,
      shieldingDone: p.shieldingDone ?? 0,
      killParticipation: 0,
      mvpScore: 0,
      isMvp: false,
      isAce: false,
    }));

    const scored = calculateMvpScores(players);
    const matchId = uuid();

    const { error } = await supabase.from("matches").insert({
      id: matchId,
      group_name: "컴학내전",
      game_duration: match.gameDuration || "",
      game_mode: match.gameMode || "rift",
      players: scored,
    });

    if (error) {
      console.error("DB insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-register new members
    const { data: existing } = await supabase.from("members").select("nickname");
    const existingSet = new Set((existing || []).map((m) => m.nickname));

    const newMembers = scored
      .filter((p) => !existingSet.has(p.nickname))
      .map((p) => ({ nickname: p.nickname }));

    if (newMembers.length > 0) {
      await supabase.from("members").insert(newMembers);
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
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

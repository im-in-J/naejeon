import { getSupabase } from "./supabase";
import type { Group, Match, PlayerStat, Member, Lane } from "./types";
import { calculateMvpScores } from "./mvp";
import { v4 as uuid } from "uuid";

const GROUP_NAME = "컴학내전";

// ─── Matches ───

export async function getAllMatches(): Promise<Match[]> {
  const { data, error } = await getSupabase()
    .from("matches")
    .select("*")
    .eq("group_name", GROUP_NAME)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    groupId: GROUP_NAME,
    createdAt: row.created_at,
    gameDuration: row.game_duration || "",
    players: row.players as PlayerStat[],
  }));
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const { data, error } = await getSupabase()
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    groupId: GROUP_NAME,
    createdAt: data.created_at,
    gameDuration: data.game_duration || "",
    players: data.players as PlayerStat[],
  };
}

export async function addMatch(
  players: PlayerStat[],
  gameDuration: string
): Promise<Match> {
  const scored = calculateMvpScores(players);
  const id = uuid();

  const { error } = await getSupabase().from("matches").insert({
    id,
    group_name: GROUP_NAME,
    game_duration: gameDuration,
    players: scored,
  });

  if (error) throw new Error(error.message);

  // Auto-register new players as members
  const existingMembers = await getAllMembers();
  const existingNicknames = new Set(existingMembers.map((m) => m.nickname));

  for (const p of scored) {
    if (!existingNicknames.has(p.nickname)) {
      await getSupabase().from("members").insert({ nickname: p.nickname });
      existingNicknames.add(p.nickname);
    }
  }

  return {
    id,
    groupId: GROUP_NAME,
    createdAt: new Date().toISOString(),
    gameDuration,
    players: scored,
  };
}

export async function deleteMatch(matchId: string) {
  await getSupabase().from("matches").delete().eq("id", matchId);
}

// ─── Members ───

export async function getAllMembers(): Promise<Member[]> {
  const { data, error } = await getSupabase()
    .from("members")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.nickname,
    nickname: row.nickname,
    groupId: GROUP_NAME,
    joinedAt: row.created_at,
    tier: row.tier || undefined,
    preferredLanes: (row.preferred_lanes as Lane[]) || undefined,
    realName: row.real_name || undefined,
    aliases: (row.aliases as string[]) || undefined,
  }));
}

export async function updateMemberProfile(
  nickname: string,
  updates: { tier?: string; preferredLanes?: Lane[]; realName?: string; aliases?: string[] }
) {
  const updateData: Record<string, unknown> = {};
  if (updates.tier !== undefined) updateData.tier = updates.tier || null;
  if (updates.preferredLanes !== undefined) updateData.preferred_lanes = updates.preferredLanes;
  if (updates.realName !== undefined) updateData.real_name = updates.realName || null;
  if (updates.aliases !== undefined) updateData.aliases = updates.aliases;

  await getSupabase().from("members").update(updateData).eq("nickname", nickname);
}

export async function mergeAliases(mainNickname: string, aliasNickname: string) {
  // 1. Get main member
  const { data: main } = await getSupabase()
    .from("members")
    .select("*")
    .eq("nickname", mainNickname)
    .single();

  if (!main) return;

  // 2. Update aliases
  const aliases = (main.aliases as string[]) || [];
  if (!aliases.includes(aliasNickname)) aliases.push(aliasNickname);
  await getSupabase().from("members").update({ aliases }).eq("nickname", mainNickname);

  // 3. Rename in all match data
  const { data: matches } = await getSupabase()
    .from("matches")
    .select("id, players")
    .eq("group_name", GROUP_NAME);

  if (matches) {
    for (const match of matches) {
      const players = match.players as PlayerStat[];
      let changed = false;
      for (const p of players) {
        if (p.nickname === aliasNickname) {
          p.nickname = mainNickname;
          changed = true;
        }
      }
      if (changed) {
        await getSupabase().from("matches").update({ players }).eq("id", match.id);
      }
    }
  }

  // 4. Delete alias member
  await getSupabase().from("members").delete().eq("nickname", aliasNickname);
}

// ─── Group Helper (for compatibility with existing components) ───

export async function getGroup(): Promise<Group> {
  const [matches, members] = await Promise.all([getAllMatches(), getAllMembers()]);
  return {
    id: GROUP_NAME,
    name: GROUP_NAME,
    inviteCode: "",
    createdAt: "",
    members,
    matches,
  };
}

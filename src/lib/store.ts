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
    bans: (row.bans as Match["bans"]) || undefined,
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
    bans: (data.bans as Match["bans"]) || undefined,
  };
}

export async function addMatch(
  players: PlayerStat[],
  gameDuration: string
): Promise<Match> {
  // 부캐 닉네임 → 본캐 닉네임 매핑 (아이디 통합이 수동 등록에도 유지되도록)
  const existingMembers = await getAllMembers();
  const aliasMap = new Map<string, string>();
  for (const m of existingMembers) {
    for (const a of m.aliases || []) aliasMap.set(a, m.nickname);
  }
  const normalized = players.map((p) => ({
    ...p,
    nickname: aliasMap.get(p.nickname) || p.nickname,
  }));

  const scored = calculateMvpScores(normalized);
  const id = uuid();

  const { error } = await getSupabase().from("matches").insert({
    id,
    group_name: GROUP_NAME,
    game_duration: gameDuration,
    players: scored,
  });

  if (error) throw new Error(error.message);

  // Auto-register new players as members
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

export async function mergeAliases(mainNickname: string, aliasNickname: string): Promise<number> {
  // 1. Get main member (members에 없으면 생성 — 없다고 조용히 실패하면 안 됨)
  let { data: main } = await getSupabase()
    .from("members")
    .select("*")
    .eq("nickname", mainNickname)
    .single();

  if (!main) {
    await getSupabase().from("members").upsert({ nickname: mainNickname }, { onConflict: "nickname" });
    main = { nickname: mainNickname, aliases: [] };
  }

  // 2. Update aliases (부캐가 이미 갖고 있던 부캐 목록도 승계)
  const { data: aliasMember } = await getSupabase()
    .from("members")
    .select("aliases")
    .eq("nickname", aliasNickname)
    .single();

  const aliases = (main.aliases as string[]) || [];
  const toAdd = [aliasNickname, ...((aliasMember?.aliases as string[]) || [])];
  for (const a of toAdd) {
    if (a !== mainNickname && !aliases.includes(a)) aliases.push(a);
  }
  await getSupabase().from("members").update({ aliases }).eq("nickname", mainNickname);

  // 3. Rename in all match data
  const { data: matches } = await getSupabase()
    .from("matches")
    .select("id, players")
    .eq("group_name", GROUP_NAME);

  let renamedMatches = 0;
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
        const { error } = await getSupabase().from("matches").update({ players }).eq("id", match.id);
        if (!error) renamedMatches++;
      }
    }
  }

  // 4. Delete alias member
  await getSupabase().from("members").delete().eq("nickname", aliasNickname);

  return renamedMatches;
}

// ─── Member Rename / Delete ───

export async function renameMember(oldNickname: string, newNickname: string) {
  const sb = getSupabase();

  // 1. Rename in all match data
  const { data: matches } = await sb
    .from("matches")
    .select("id, players")
    .eq("group_name", GROUP_NAME);

  if (matches) {
    for (const match of matches) {
      const players = match.players as PlayerStat[];
      let changed = false;
      for (const p of players) {
        if (p.nickname === oldNickname) {
          p.nickname = newNickname;
          changed = true;
        }
      }
      if (changed) {
        await sb.from("matches").update({ players }).eq("id", match.id);
      }
    }
  }

  // 2. Create new member with old data, delete old
  const { data: old } = await sb.from("members").select("*").eq("nickname", oldNickname).single();
  if (old) {
    await sb.from("members").upsert({
      nickname: newNickname,
      real_name: old.real_name,
      tier: old.tier,
      preferred_lanes: old.preferred_lanes,
      aliases: old.aliases,
    }, { onConflict: "nickname" });
    await sb.from("members").delete().eq("nickname", oldNickname);
  }
}

export async function deleteMember(nickname: string) {
  // Remove from matches (replace with "삭제된 유저")
  const sb = getSupabase();
  const { data: matches } = await sb
    .from("matches")
    .select("id, players")
    .eq("group_name", GROUP_NAME);

  if (matches) {
    for (const match of matches) {
      const players = match.players as PlayerStat[];
      let changed = false;
      for (const p of players) {
        if (p.nickname === nickname) {
          p.nickname = `[삭제] ${nickname}`;
          changed = true;
        }
      }
      if (changed) {
        await sb.from("matches").update({ players }).eq("id", match.id);
      }
    }
  }

  await sb.from("members").delete().eq("nickname", nickname);
}

// ─── Match Update ───

export async function updateMatch(matchId: string, players: PlayerStat[], gameDuration?: string) {
  const sb = getSupabase();
  const scored = calculateMvpScores(players);
  const updateData: Record<string, unknown> = { players: scored };
  if (gameDuration !== undefined) updateData.game_duration = gameDuration;
  await sb.from("matches").update(updateData).eq("id", matchId);
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

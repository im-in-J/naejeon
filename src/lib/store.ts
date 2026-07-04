// Local storage based store (Supabase로 마이그레이션 가능)
import type { Group, Match, PlayerStat, Lane } from "./types";
import { v4 as uuid } from "uuid";

const STORAGE_KEY = "naejeon_data";

interface StoreData {
  groups: Group[];
}

function getData(): StoreData {
  if (typeof window === "undefined") return { groups: [] };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { groups: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { groups: [] };
  }
}

function setData(data: StoreData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createGroup(name: string): Group {
  const data = getData();
  const group: Group = {
    id: uuid(),
    name,
    inviteCode: uuid().slice(0, 8),
    createdAt: new Date().toISOString(),
    members: [],
    matches: [],
  };
  data.groups.push(group);
  setData(data);
  return group;
}

export function getGroup(id: string): Group | null {
  return getData().groups.find((g) => g.id === id) ?? null;
}

export function getGroupByInvite(code: string): Group | null {
  return getData().groups.find((g) => g.inviteCode === code) ?? null;
}

export function getAllGroups(): Group[] {
  return getData().groups;
}

export function addMember(groupId: string, nickname: string) {
  const data = getData();
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return;
  if (group.members.some((m) => m.nickname === nickname)) return;
  group.members.push({
    id: uuid(),
    nickname,
    groupId,
    joinedAt: new Date().toISOString(),
  });
  setData(data);
}

export function addMatch(groupId: string, players: PlayerStat[], gameDuration: string): Match {
  const data = getData();
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) throw new Error("Group not found");

  const match: Match = {
    id: uuid(),
    groupId,
    createdAt: new Date().toISOString(),
    gameDuration,
    players,
  };
  group.matches.push(match);

  // Auto-register new nicknames as members
  for (const p of players) {
    if (!group.members.some((m) => m.nickname === p.nickname)) {
      group.members.push({
        id: uuid(),
        nickname: p.nickname,
        groupId,
        joinedAt: new Date().toISOString(),
      });
    }
  }

  setData(data);
  return match;
}

export function getMatch(groupId: string, matchId: string): Match | null {
  const group = getGroup(groupId);
  if (!group) return null;
  return group.matches.find((m) => m.id === matchId) ?? null;
}

export function deleteMatch(groupId: string, matchId: string) {
  const data = getData();
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return;
  group.matches = group.matches.filter((m) => m.id !== matchId);
  setData(data);
}

export function updateMemberProfile(
  groupId: string,
  nickname: string,
  updates: { tier?: string; preferredLanes?: Lane[]; realName?: string; aliases?: string[] }
) {
  const data = getData();
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return;
  const member = group.members.find((m) => m.nickname === nickname);
  if (!member) return;
  if (updates.tier !== undefined) member.tier = updates.tier;
  if (updates.preferredLanes !== undefined) member.preferredLanes = updates.preferredLanes;
  if (updates.realName !== undefined) member.realName = updates.realName;
  if (updates.aliases !== undefined) member.aliases = updates.aliases;
  setData(data);
}

// 부캐 아이디 통합: alias 닉네임의 매치 기록을 메인 닉네임으로 합산
export function mergeAliases(groupId: string, mainNickname: string, aliasNickname: string) {
  const data = getData();
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return;

  // Add alias to main member
  const main = group.members.find((m) => m.nickname === mainNickname);
  if (!main) return;
  if (!main.aliases) main.aliases = [];
  if (!main.aliases.includes(aliasNickname)) main.aliases.push(aliasNickname);

  // Rename alias nickname in all match data
  for (const match of group.matches) {
    for (const p of match.players) {
      if (p.nickname === aliasNickname) {
        p.nickname = mainNickname;
      }
    }
  }

  // Remove alias member entry
  group.members = group.members.filter((m) => m.nickname !== aliasNickname);

  setData(data);
}

// 부캐 통합 해제
export function unmergeAlias(groupId: string, mainNickname: string, aliasNickname: string) {
  const data = getData();
  const group = data.groups.find((g) => g.id === groupId);
  if (!group) return;

  const main = group.members.find((m) => m.nickname === mainNickname);
  if (!main || !main.aliases) return;
  main.aliases = main.aliases.filter((a) => a !== aliasNickname);

  // Note: match data는 이미 변환됐으므로 되돌리지 않음 (되돌리려면 원본 데이터 필요)
  setData(data);
}

export function importGroup(name: string, matches: Match[]): Group {
  const data = getData();

  // Check if already imported
  const existing = data.groups.find((g) => g.name === name);
  if (existing) return existing;

  const group: Group = {
    id: uuid(),
    name,
    inviteCode: uuid().slice(0, 8),
    createdAt: new Date().toISOString(),
    members: [],
    matches: [],
  };

  // Add matches and auto-register members
  for (const match of matches) {
    match.groupId = group.id;
    group.matches.push(match);
    for (const p of match.players) {
      if (!group.members.some((m) => m.nickname === p.nickname)) {
        group.members.push({
          id: uuid(),
          nickname: p.nickname,
          groupId: group.id,
          joinedAt: new Date().toISOString(),
        });
      }
    }
  }

  data.groups.push(group);
  setData(data);
  return group;
}

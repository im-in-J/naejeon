import importedData from "./imported-data.json";
import type { Match, PlayerStat } from "./types";
import { calculateMvpScores } from "./mvp";
import { v4 as uuid } from "uuid";

interface NaejeonMatch {
  id: string;
  played_at: string;
  created_at: string;
  duration: string;
  team1_data: {
    gold: number;
    result: string;
    players: NaejeonPlayer[];
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
  };
  team2_data: {
    gold: number;
    result: string;
    players: NaejeonPlayer[];
    totalKills: number;
    totalDeaths: number;
    totalAssists: number;
  };
  game_mode: string;
}

interface NaejeonPlayer {
  cs: number;
  gold: number;
  lane: string;
  name: string;
  kills: number;
  level: number;
  deaths: number;
  assists: number;
  champion: string;
  opponent?: string;
}

export function importNaejeonData(): { groupName: string; matches: Match[] } {
  const rawMatches = importedData as NaejeonMatch[];

  const matches: Match[] = rawMatches.map((m) => {
    const team1Win = m.team1_data.result === "승리";

    const team1Players: PlayerStat[] = m.team1_data.players.map((p, i) => ({
      id: `t1-${i}`,
      matchId: m.id,
      nickname: p.name,
      champion: p.champion,
      lane: p.lane as "top" | "jungle" | "mid" | "adc" | "support" | undefined,
      team: "blue" as const,
      win: team1Win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.cs,
      gold: p.gold,
      damageDealt: 0,
      damageTaken: 0,
      visionScore: 0,
      wardsPlaced: 0,
      wardsDestroyed: 0,
      objectiveDamage: 0,
      ccScore: 0,
      healingDone: 0,
      shieldingDone: 0,
      killParticipation: 0,
      mvpScore: 0,
      isMvp: false,
      isAce: false,
    }));

    const team2Players: PlayerStat[] = m.team2_data.players.map((p, i) => ({
      id: `t2-${i}`,
      matchId: m.id,
      nickname: p.name,
      champion: p.champion,
      team: "red" as const,
      win: !team1Win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.cs,
      gold: p.gold,
      damageDealt: 0,
      damageTaken: 0,
      visionScore: 0,
      wardsPlaced: 0,
      wardsDestroyed: 0,
      objectiveDamage: 0,
      ccScore: 0,
      healingDone: 0,
      shieldingDone: 0,
      killParticipation: 0,
      mvpScore: 0,
      isMvp: false,
      isAce: false,
    }));

    const allPlayers = calculateMvpScores([...team1Players, ...team2Players]);

    return {
      id: m.id,
      groupId: "",
      createdAt: m.created_at || m.played_at,
      gameDuration: m.duration,
      players: allPlayers,
    };
  });

  return {
    groupName: "컴학내전",
    matches,
  };
}

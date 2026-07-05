import type { Group, Match, PlayerStat, Lane } from "./types";

// ─── Player Stats ───

export interface PlayerStats {
  nickname: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgKda: number;
  avgCs: number;
  avgGold: number;
  avgDamage: number;
  avgDamageTaken: number;
  avgVision: number;
  mvpCount: number;
  aceCount: number;
  totalScore: number;
  champions: ChampionUsage[];
  laneStats: LaneUsage[];
  recentMatches: { win: boolean; date: string }[];
}

export interface LaneUsage {
  lane: Lane;
  games: number;
  wins: number;
  winRate: number;
  avgKda: number;
}

export interface ChampionUsage {
  champion: string;
  games: number;
  wins: number;
  winRate: number;
  avgKda: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
}

export function buildPlayerStats(group: Group): PlayerStats[] {
  const map = new Map<string, PlayerStat[]>();

  for (const match of group.matches) {
    for (const p of match.players) {
      const arr = map.get(p.nickname) || [];
      arr.push(p);
      map.set(p.nickname, arr);
    }
  }

  return Array.from(map.entries())
    .map(([nickname, stats]) => {
      const wins = stats.filter((s) => s.win).length;
      const losses = stats.length - wins;
      const totalKills = stats.reduce((s, p) => s + p.kills, 0);
      const totalDeaths = stats.reduce((s, p) => s + p.deaths, 0);
      const totalAssists = stats.reduce((s, p) => s + p.assists, 0);
      const avgKda =
        totalDeaths === 0
          ? (totalKills + totalAssists) * 1.2
          : (totalKills + totalAssists) / totalDeaths;

      // Champion breakdown
      const champMap = new Map<string, PlayerStat[]>();
      for (const s of stats) {
        if (!s.champion) continue;
        const arr = champMap.get(s.champion) || [];
        arr.push(s);
        champMap.set(s.champion, arr);
      }
      const champions: ChampionUsage[] = Array.from(champMap.entries())
        .map(([champion, cs]) => {
          const cWins = cs.filter((c) => c.win).length;
          const cDeaths = cs.reduce((s, c) => s + c.deaths, 0);
          const cKills = cs.reduce((s, c) => s + c.kills, 0);
          const cAssists = cs.reduce((s, c) => s + c.assists, 0);
          return {
            champion,
            games: cs.length,
            wins: cWins,
            winRate: (cWins / cs.length) * 100,
            avgKda: cDeaths === 0 ? (cKills + cAssists) * 1.2 : (cKills + cAssists) / cDeaths,
            avgKills: cKills / cs.length,
            avgDeaths: cDeaths / cs.length,
            avgAssists: cAssists / cs.length,
          };
        })
        .sort((a, b) => b.games - a.games);

      // Lane breakdown
      const laneMap = new Map<Lane, PlayerStat[]>();
      for (const s of stats) {
        if (!s.lane) continue;
        const arr = laneMap.get(s.lane) || [];
        arr.push(s);
        laneMap.set(s.lane, arr);
      }
      const laneStats: LaneUsage[] = (["top", "jungle", "mid", "adc", "support"] as Lane[])
        .filter((lane) => laneMap.has(lane))
        .map((lane) => {
          const ls = laneMap.get(lane)!;
          const lWins = ls.filter((l) => l.win).length;
          const lDeaths = ls.reduce((s, l) => s + l.deaths, 0);
          const lKills = ls.reduce((s, l) => s + l.kills, 0);
          const lAssists = ls.reduce((s, l) => s + l.assists, 0);
          return {
            lane,
            games: ls.length,
            wins: lWins,
            winRate: (lWins / ls.length) * 100,
            avgKda: lDeaths === 0 ? (lKills + lAssists) * 1.2 : (lKills + lAssists) / lDeaths,
          };
        })
        .sort((a, b) => b.games - a.games);

      // Recent matches (last 10)
      const matchDates = new Map<string, string>();
      for (const m of group.matches) {
        for (const p of m.players) {
          if (p.nickname === nickname) {
            matchDates.set(m.id, m.createdAt);
          }
        }
      }
      const recentMatches = stats
        .map((s) => ({
          win: s.win,
          date: matchDates.get(s.matchId) || "",
        }))
        .slice(-10);

      const winRate = stats.length > 0 ? (wins / stats.length) * 100 : 0;
      const mvpCount = stats.filter((s) => s.isMvp).length;
      const aceCount = stats.filter((s) => s.isAce).length;
      const totalScore =
        avgKda * 15 + winRate * 0.8 + Math.log(stats.length + 1) * 8 + mvpCount * 5;

      return {
        nickname,
        gamesPlayed: stats.length,
        wins,
        losses,
        winRate,
        totalKills,
        totalDeaths,
        totalAssists,
        avgKills: totalKills / stats.length,
        avgDeaths: totalDeaths / stats.length,
        avgAssists: totalAssists / stats.length,
        avgKda,
        avgCs: stats.reduce((s, p) => s + p.cs, 0) / stats.length,
        avgGold: stats.reduce((s, p) => s + p.gold, 0) / stats.length,
        avgDamage: stats.reduce((s, p) => s + (p.damageDealt || 0), 0) / stats.length,
        avgDamageTaken: stats.reduce((s, p) => s + (p.damageTaken || 0), 0) / stats.length,
        avgVision: stats.reduce((s, p) => s + (p.visionScore || 0), 0) / stats.length,
        mvpCount,
        aceCount,
        totalScore,
        champions,
        laneStats,
        recentMatches,
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore);
}

// ─── Radar Stats (5각 스탯) ───
// 각 축은 그룹 내 백분위(0~100). 골드차이는 같은 포지션 상대와의
// 분당 골드 차이 (포지션 정보가 없으면 상대팀 평균 대비로 폴백).

export interface RadarStats {
  nickname: string;
  goldDiff: number; // 골드차이
  combat: number; // 전투 (분당 딜량 + 킬관여)
  growth: number; // 성장 (분당 CS + 분당 골드)
  vision: number; // 시야 (분당 시야점수)
  survival: number; // 생존 (분당 데스 억제)
}

function parseDurationMinutes(duration: string): number {
  const parts = duration.split(":").map((n) => parseInt(n, 10));
  if (parts.some(isNaN) || parts.length < 2) return 30;
  const seconds = parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
  return seconds > 0 ? seconds / 60 : 30;
}

function percentileOf(pool: number[], v: number): number {
  if (pool.length <= 1) return 50;
  let less = 0;
  let equal = 0;
  for (const x of pool) {
    if (x < v) less++;
    else if (x === v) equal++;
  }
  return ((less + equal / 2) / pool.length) * 100;
}

export function buildRadarStats(group: Group): Map<string, RadarStats> {
  interface Raw { dpm: number[]; kp: number[]; cspm: number[]; gpm: number[]; vspm: number[]; deathsPm: number[]; goldDiffPm: number[] }
  const rawMap = new Map<string, Raw>();

  for (const match of group.matches) {
    const minutes = parseDurationMinutes(match.gameDuration);
    for (const p of match.players) {
      const teammates = match.players.filter((q) => q.team === p.team);
      const enemies = match.players.filter((q) => q.team !== p.team);
      const teamKills = teammates.reduce((s, q) => s + q.kills, 0);
      // 맞라인 상대 우선, 없으면 상대팀 평균
      const laneOpponents = p.lane ? enemies.filter((q) => q.lane === p.lane) : [];
      const refPool = laneOpponents.length > 0 ? laneOpponents : enemies;
      const enemyAvgGold = refPool.length > 0
        ? refPool.reduce((s, q) => s + q.gold, 0) / refPool.length
        : p.gold;

      const raw = rawMap.get(p.nickname) || { dpm: [], kp: [], cspm: [], gpm: [], vspm: [], deathsPm: [], goldDiffPm: [] };
      raw.dpm.push((p.damageDealt || 0) / minutes);
      raw.kp.push(teamKills > 0 ? (p.kills + p.assists) / teamKills : 0);
      raw.cspm.push(p.cs / minutes);
      raw.gpm.push(p.gold / minutes);
      raw.vspm.push((p.visionScore || 0) / minutes);
      raw.deathsPm.push(p.deaths / minutes);
      raw.goldDiffPm.push((p.gold - enemyAvgGold) / minutes);
      rawMap.set(p.nickname, raw);
    }
  }

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const players = Array.from(rawMap.entries()).map(([nickname, raw]) => ({
    nickname,
    dpm: avg(raw.dpm),
    kp: avg(raw.kp),
    cspm: avg(raw.cspm),
    gpm: avg(raw.gpm),
    vspm: avg(raw.vspm),
    deathsPm: avg(raw.deathsPm),
    goldDiffPm: avg(raw.goldDiffPm),
  }));

  const pools = {
    dpm: players.map((p) => p.dpm),
    kp: players.map((p) => p.kp),
    cspm: players.map((p) => p.cspm),
    gpm: players.map((p) => p.gpm),
    vspm: players.map((p) => p.vspm),
    deathsPm: players.map((p) => p.deathsPm),
    goldDiffPm: players.map((p) => p.goldDiffPm),
  };

  const result = new Map<string, RadarStats>();
  for (const p of players) {
    result.set(p.nickname, {
      nickname: p.nickname,
      goldDiff: percentileOf(pools.goldDiffPm, p.goldDiffPm),
      combat: percentileOf(pools.dpm, p.dpm) * 0.5 + percentileOf(pools.kp, p.kp) * 0.5,
      growth: percentileOf(pools.cspm, p.cspm) * 0.5 + percentileOf(pools.gpm, p.gpm) * 0.5,
      vision: percentileOf(pools.vspm, p.vspm),
      survival: 100 - percentileOf(pools.deathsPm, p.deathsPm),
    });
  }
  return result;
}

// ─── Champion Stats ───

export interface ChampionStats {
  champion: string;
  totalGames: number;
  wins: number;
  winRate: number;
  avgKda: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgCs: number;
  avgGold: number;
  avgDamage: number;
  players: { nickname: string; games: number; wins: number; winRate: number }[];
}

export function buildChampionStats(group: Group): ChampionStats[] {
  const map = new Map<string, PlayerStat[]>();

  for (const match of group.matches) {
    for (const p of match.players) {
      if (!p.champion) continue;
      const arr = map.get(p.champion) || [];
      arr.push(p);
      map.set(p.champion, arr);
    }
  }

  return Array.from(map.entries())
    .map(([champion, stats]) => {
      const wins = stats.filter((s) => s.win).length;
      const totalKills = stats.reduce((s, p) => s + p.kills, 0);
      const totalDeaths = stats.reduce((s, p) => s + p.deaths, 0);
      const totalAssists = stats.reduce((s, p) => s + p.assists, 0);

      // Per-player breakdown
      const playerMap = new Map<string, PlayerStat[]>();
      for (const s of stats) {
        const arr = playerMap.get(s.nickname) || [];
        arr.push(s);
        playerMap.set(s.nickname, arr);
      }
      const players = Array.from(playerMap.entries())
        .map(([nickname, ps]) => ({
          nickname,
          games: ps.length,
          wins: ps.filter((p) => p.win).length,
          winRate: (ps.filter((p) => p.win).length / ps.length) * 100,
        }))
        .sort((a, b) => b.games - a.games);

      return {
        champion,
        totalGames: stats.length,
        wins,
        winRate: (wins / stats.length) * 100,
        avgKda:
          totalDeaths === 0
            ? (totalKills + totalAssists) * 1.2
            : (totalKills + totalAssists) / totalDeaths,
        avgKills: totalKills / stats.length,
        avgDeaths: totalDeaths / stats.length,
        avgAssists: totalAssists / stats.length,
        avgCs: stats.reduce((s, p) => s + p.cs, 0) / stats.length,
        avgGold: stats.reduce((s, p) => s + p.gold, 0) / stats.length,
        avgDamage: stats.reduce((s, p) => s + (p.damageDealt || 0), 0) / stats.length,
        players,
      };
    })
    .sort((a, b) => b.totalGames - a.totalGames);
}

// ─── Awards ───

export interface Award {
  title: string;
  emoji: string;
  player: string;
  value: string;
}

export function computeAwards(group: Group, playerStats: PlayerStats[]): Award[] {
  const awards: Award[] = [];
  if (playerStats.length === 0) return awards;

  const qualified = playerStats.filter((e) => e.gamesPlayed >= 2);

  const mostMvp = [...playerStats].sort((a, b) => b.mvpCount - a.mvpCount)[0];
  if (mostMvp.mvpCount > 0)
    awards.push({ title: "MVP 헌터", emoji: "🏆", player: mostMvp.nickname, value: `${mostMvp.mvpCount}회` });

  const bestKda = [...qualified].sort((a, b) => b.avgKda - a.avgKda)[0];
  if (bestKda)
    awards.push({ title: "KDA 장인", emoji: "⚔️", player: bestKda.nickname, value: `${bestKda.avgKda.toFixed(2)}` });

  const bestWr = playerStats.filter((e) => e.gamesPlayed >= 3).sort((a, b) => b.winRate - a.winRate)[0];
  if (bestWr)
    awards.push({ title: "승리 요정", emoji: "✨", player: bestWr.nickname, value: `${bestWr.winRate.toFixed(0)}%` });

  const mostDeaths = [...playerStats].sort((a, b) => b.totalDeaths - a.totalDeaths)[0];
  if (mostDeaths && mostDeaths.totalDeaths > 0)
    awards.push({ title: "공공의 적", emoji: "💀", player: mostDeaths.nickname, value: `${mostDeaths.totalDeaths} 데스` });

  const farmKing = [...qualified].sort((a, b) => b.avgCs - a.avgCs)[0];
  if (farmKing)
    awards.push({ title: "농사왕", emoji: "🌾", player: farmKing.nickname, value: `평균 ${Math.round(farmKing.avgCs)} CS` });

  const mostKills = [...playerStats].sort((a, b) => b.totalKills - a.totalKills)[0];
  if (mostKills && mostKills.totalKills > 0)
    awards.push({ title: "킬 수집가", emoji: "🗡️", player: mostKills.nickname, value: `${mostKills.totalKills} 킬` });

  const mostGames = [...playerStats].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
  if (mostGames)
    awards.push({ title: "내전 중독", emoji: "🎮", player: mostGames.nickname, value: `${mostGames.gamesPlayed}판` });

  const bestGold = [...qualified].sort((a, b) => b.avgGold - a.avgGold)[0];
  if (bestGold)
    awards.push({ title: "골드 부자", emoji: "💰", player: bestGold.nickname, value: `평균 ${Math.round(bestGold.avgGold).toLocaleString()}` });

  // 최다 ACE
  const mostAce = [...playerStats].sort((a, b) => b.aceCount - a.aceCount)[0];
  if (mostAce && mostAce.aceCount > 0)
    awards.push({ title: "최다 ACE", emoji: "🌟", player: mostAce.nickname, value: `${mostAce.aceCount}회` });

  // 듀오 통계 (같은 팀 기록)
  const duoMap = new Map<string, { wins: number; total: number }>();
  const oppMap = new Map<string, number>(); // 같은 팀 못한 횟수 계산용: 적팀 만난 수
  for (const m of group.matches) {
    const blue = m.players.filter((p) => p.team === "blue");
    const red = m.players.filter((p) => p.team === "red");
    for (const team of [blue, red]) {
      const win = team.length > 0 && team[0].win;
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const key = [team[i].nickname, team[j].nickname].sort().join("|||");
          const entry = duoMap.get(key) || { wins: 0, total: 0 };
          entry.total++;
          if (win) entry.wins++;
          duoMap.set(key, entry);
        }
      }
    }

    for (const bp of blue) {
      for (const rp of red) {
        const key = [bp.nickname, rp.nickname].sort().join("|||");
        oppMap.set(key, (oppMap.get(key) || 0) + 1);
      }
    }
  }

  // 베스트 듀오 (같은 팀 승률 최고, 최소 3판)
  let bestDuo: { key: string; wr: number; total: number } | null = null;
  let worstDuo: { key: string; wr: number; total: number } | null = null;
  for (const [key, { wins, total }] of duoMap) {
    if (total < 3) continue;
    const wr = wins / total;
    if (!bestDuo || wr > bestDuo.wr || (wr === bestDuo.wr && total > bestDuo.total))
      bestDuo = { key, wr, total };
    if (!worstDuo || wr < worstDuo.wr || (wr === worstDuo.wr && total > worstDuo.total))
      worstDuo = { key, wr, total };
  }

  if (bestDuo) {
    const [p1, p2] = bestDuo.key.split("|||");
    awards.push({ title: "베스트 듀오", emoji: "🤝", player: `${p1} & ${p2}`, value: `${(bestDuo.wr * 100).toFixed(0)}% (${bestDuo.total}판)` });
  }

  if (worstDuo) {
    const [p1, p2] = worstDuo.key.split("|||");
    awards.push({ title: "워스트 듀오", emoji: "💔", player: `${p1} & ${p2}`, value: `${(worstDuo.wr * 100).toFixed(0)}% (${worstDuo.total}판)` });
  }

  // 견우와 직녀 (적팀으로 가장 많이 만나고 같은 팀은 거의 없는 두 명)
  let starCrossed: { key: string; oppGames: number; sameGames: number; ratio: number } | null = null;
  for (const [key, oppGames] of oppMap) {
    const sameGames = duoMap.get(key)?.total || 0;
    const ratio = oppGames / (sameGames + 1);
    if (oppGames < 3) continue;
    if (!starCrossed || ratio > starCrossed.ratio)
      starCrossed = { key, oppGames, sameGames, ratio };
  }

  if (starCrossed) {
    const [p1, p2] = starCrossed.key.split("|||");
    awards.push({
      title: "견우와 직녀",
      emoji: "🌌",
      player: `${p1} & ${p2}`,
      value: `적팀 ${starCrossed.oppGames}회 / 같은팀 ${starCrossed.sameGames}회`,
    });
  }

  return awards;
}

// ─── Team Balancer ───

export interface BalancerPlayer {
  nickname: string;
  score: number; // Internal rating for balancing
  tier?: string;
  gamesPlayed: number;
  winRate: number;
  avgKda: number;
}

// Base scores per tier (4=lowest, 1=highest within tier)
const TIER_BASE: Record<string, number> = {
  "실버": 3, "골드": 4, "플래티넘": 5, "에메랄드": 6, "다이아": 7, "마스터": 8,
};

function parseTierScore(tier: string): number {
  if (!tier) return 5; // Default to 플래티넘 level
  const parts = tier.split(" ");
  const base = TIER_BASE[parts[0]];
  if (!base) return 5;
  if (parts.length === 1) return base; // 마스터
  const division = parseInt(parts[1]) || 1;
  // Division 4=0.00, 3=0.25, 2=0.50, 1=0.75
  return base + (4 - division) * 0.25;
}

export function getBalancerPlayers(playerStats: PlayerStats[], tierOverrides: Record<string, string>): BalancerPlayer[] {
  return playerStats.map((p) => {
    const tier = tierOverrides[p.nickname] || "";
    const tierScore = parseTierScore(tier);
    // Weighted: 60% tier, 40% internal performance
    const perfScore = (p.avgKda * 0.5 + p.winRate * 0.03 + Math.min(p.avgCs / 30, 3)) * 2;
    const score = tierScore * 0.6 + perfScore * 0.4;

    return {
      nickname: p.nickname,
      score: Math.round(score * 100) / 100,
      tier: tier || undefined,
      gamesPlayed: p.gamesPlayed,
      winRate: p.winRate,
      avgKda: p.avgKda,
    };
  });
}

export function balanceTeams(
  players: BalancerPlayer[]
): { team1: BalancerPlayer[]; team2: BalancerPlayer[]; diff: number } | null {
  if (players.length < 2 || players.length > 10) return null;

  const n = players.length;
  const teamSize = Math.floor(n / 2);
  const sorted = [...players].sort((a, b) => b.score - a.score);

  let bestTeam1: BalancerPlayer[] = [];
  let bestTeam2: BalancerPlayer[] = [];
  let bestDiff = Infinity;

  // For small groups, try all combinations
  if (n <= 10) {
    const combinations = getCombinations(sorted, teamSize);
    for (const team1 of combinations) {
      const team1Set = new Set(team1.map((p) => p.nickname));
      const team2 = sorted.filter((p) => !team1Set.has(p.nickname));
      const score1 = team1.reduce((s, p) => s + p.score, 0);
      const score2 = team2.reduce((s, p) => s + p.score, 0);
      const diff = Math.abs(score1 - score2);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestTeam1 = team1;
        bestTeam2 = team2;
      }
    }
  }

  return { team1: bestTeam1, team2: bestTeam2, diff: Math.round(bestDiff * 100) / 100 };
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  const withFirst = getCombinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = getCombinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

// ─── Team Side Stats (진영별 통계) ───

export interface TeamSideOverall {
  team: "blue" | "red";
  totalGames: number;
  wins: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgGold: number;
}

export interface PlayerTeamSide {
  nickname: string;
  blue: { games: number; wins: number; winRate: number; avgKda: number; avgKills: number; avgDeaths: number; avgAssists: number };
  red: { games: number; wins: number; winRate: number; avgKda: number; avgKills: number; avgDeaths: number; avgAssists: number };
  total: { games: number; wins: number; winRate: number };
  blueWinDiff: number; // blue승률 - red승률
}

export interface ChampionTeamSide {
  champion: string;
  blue: { games: number; wins: number; winRate: number };
  red: { games: number; wins: number; winRate: number };
  total: { games: number; wins: number; winRate: number };
}

export interface DuoRecord {
  player1: string;
  player2: string;
  sameTeamGames: number;
  sameTeamWins: number;
  sameTeamWinRate: number;
  oppositeGames: number;
  player1Wins: number; // player1이 이긴 횟수 (상대 기록)
}

export function buildTeamSideStats(group: Group) {
  // Overall blue vs red
  let blueWins = 0;
  let redWins = 0;
  let totalGames = group.matches.length;
  let blueKillsTotal = 0;
  let redKillsTotal = 0;
  let blueDeathsTotal = 0;
  let redDeathsTotal = 0;
  let blueGoldTotal = 0;
  let redGoldTotal = 0;

  for (const m of group.matches) {
    const blue = m.players.filter((p) => p.team === "blue");
    const red = m.players.filter((p) => p.team === "red");
    if (blue.length > 0 && blue[0].win) blueWins++;
    else redWins++;
    blueKillsTotal += blue.reduce((s, p) => s + p.kills, 0);
    redKillsTotal += red.reduce((s, p) => s + p.kills, 0);
    blueDeathsTotal += blue.reduce((s, p) => s + p.deaths, 0);
    redDeathsTotal += red.reduce((s, p) => s + p.deaths, 0);
    blueGoldTotal += blue.reduce((s, p) => s + p.gold, 0);
    redGoldTotal += red.reduce((s, p) => s + p.gold, 0);
  }

  const overall: TeamSideOverall[] = [
    {
      team: "blue",
      totalGames,
      wins: blueWins,
      winRate: totalGames > 0 ? (blueWins / totalGames) * 100 : 0,
      avgKills: totalGames > 0 ? blueKillsTotal / totalGames : 0,
      avgDeaths: totalGames > 0 ? blueDeathsTotal / totalGames : 0,
      avgGold: totalGames > 0 ? blueGoldTotal / totalGames : 0,
    },
    {
      team: "red",
      totalGames,
      wins: redWins,
      winRate: totalGames > 0 ? (redWins / totalGames) * 100 : 0,
      avgKills: totalGames > 0 ? redKillsTotal / totalGames : 0,
      avgDeaths: totalGames > 0 ? redDeathsTotal / totalGames : 0,
      avgGold: totalGames > 0 ? redGoldTotal / totalGames : 0,
    },
  ];

  // Per player
  const playerMap = new Map<string, { blue: PlayerStat[]; red: PlayerStat[] }>();
  for (const m of group.matches) {
    for (const p of m.players) {
      const entry = playerMap.get(p.nickname) || { blue: [], red: [] };
      entry[p.team].push(p);
      playerMap.set(p.nickname, entry);
    }
  }

  const buildSide = (stats: PlayerStat[]) => {
    if (stats.length === 0) return { games: 0, wins: 0, winRate: 0, avgKda: 0, avgKills: 0, avgDeaths: 0, avgAssists: 0 };
    const wins = stats.filter((s) => s.win).length;
    const k = stats.reduce((s, p) => s + p.kills, 0);
    const d = stats.reduce((s, p) => s + p.deaths, 0);
    const a = stats.reduce((s, p) => s + p.assists, 0);
    return {
      games: stats.length,
      wins,
      winRate: (wins / stats.length) * 100,
      avgKda: d === 0 ? (k + a) * 1.2 : (k + a) / d,
      avgKills: k / stats.length,
      avgDeaths: d / stats.length,
      avgAssists: a / stats.length,
    };
  };

  const players: PlayerTeamSide[] = Array.from(playerMap.entries())
    .map(([nickname, { blue, red }]) => {
      const bSide = buildSide(blue);
      const rSide = buildSide(red);
      const totalGames = blue.length + red.length;
      const totalWins = bSide.wins + rSide.wins;
      return {
        nickname,
        blue: bSide,
        red: rSide,
        total: { games: totalGames, wins: totalWins, winRate: totalGames > 0 ? (totalWins / totalGames) * 100 : 0 },
        blueWinDiff: bSide.winRate - rSide.winRate,
      };
    })
    .sort((a, b) => b.total.games - a.total.games);

  // Per champion
  const champMap = new Map<string, { blue: PlayerStat[]; red: PlayerStat[] }>();
  for (const m of group.matches) {
    for (const p of m.players) {
      if (!p.champion) continue;
      const entry = champMap.get(p.champion) || { blue: [], red: [] };
      entry[p.team].push(p);
      champMap.set(p.champion, entry);
    }
  }

  const champions: ChampionTeamSide[] = Array.from(champMap.entries())
    .map(([champion, { blue, red }]) => {
      const bWins = blue.filter((s) => s.win).length;
      const rWins = red.filter((s) => s.win).length;
      const total = blue.length + red.length;
      return {
        champion,
        blue: { games: blue.length, wins: bWins, winRate: blue.length > 0 ? (bWins / blue.length) * 100 : 0 },
        red: { games: red.length, wins: rWins, winRate: red.length > 0 ? (rWins / red.length) * 100 : 0 },
        total: { games: total, wins: bWins + rWins, winRate: total > 0 ? ((bWins + rWins) / total) * 100 : 0 },
      };
    })
    .sort((a, b) => b.total.games - a.total.games);

  // Duo records
  const duoMap = new Map<string, { same: { wins: number; total: number }; opp: { p1Wins: number; total: number } }>();
  for (const m of group.matches) {
    const blue = m.players.filter((p) => p.team === "blue");
    const red = m.players.filter((p) => p.team === "red");
    const blueWin = blue.length > 0 && blue[0].win;

    // Same team pairs
    for (const team of [blue, red]) {
      const win = team.length > 0 && team[0].win;
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const key = [team[i].nickname, team[j].nickname].sort().join("|||");
          const entry = duoMap.get(key) || { same: { wins: 0, total: 0 }, opp: { p1Wins: 0, total: 0 } };
          entry.same.total++;
          if (win) entry.same.wins++;
          duoMap.set(key, entry);
        }
      }
    }

    // Opposite team pairs
    for (const bp of blue) {
      for (const rp of red) {
        const sorted = [bp.nickname, rp.nickname].sort();
        const key = sorted.join("|||");
        const entry = duoMap.get(key) || { same: { wins: 0, total: 0 }, opp: { p1Wins: 0, total: 0 } };
        entry.opp.total++;
        if (blueWin && sorted[0] === bp.nickname) entry.opp.p1Wins++;
        if (!blueWin && sorted[0] === rp.nickname) entry.opp.p1Wins++;
        duoMap.set(key, entry);
      }
    }
  }

  const duos: DuoRecord[] = Array.from(duoMap.entries())
    .map(([key, { same, opp }]) => {
      const [p1, p2] = key.split("|||");
      return {
        player1: p1,
        player2: p2,
        sameTeamGames: same.total,
        sameTeamWins: same.wins,
        sameTeamWinRate: same.total > 0 ? (same.wins / same.total) * 100 : 0,
        oppositeGames: opp.total,
        player1Wins: opp.p1Wins,
      };
    })
    .sort((a, b) => b.sameTeamGames - a.sameTeamGames);

  return { overall, players, champions, duos };
}

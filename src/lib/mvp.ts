import type { PlayerStat } from "./types";

export function calculateMvpScores(players: PlayerStat[]): PlayerStat[] {
  if (players.length === 0) return players;

  const blueTeam = players.filter((p) => p.team === "blue");
  const redTeam = players.filter((p) => p.team === "red");

  const allPlayers = [...blueTeam, ...redTeam];

  // Calculate team totals for relative metrics
  const teamTotals = {
    blue: getTeamTotals(blueTeam),
    red: getTeamTotals(redTeam),
  };

  // Calculate raw scores
  const scored = allPlayers.map((p) => {
    const team = teamTotals[p.team];
    const kda = p.deaths === 0 ? (p.kills + p.assists) * 1.2 : (p.kills + p.assists) / p.deaths;
    const killPart = team.kills > 0 ? (p.kills + p.assists) / team.kills : 0;
    const damageShare = team.damage > 0 ? p.damageDealt / team.damage : 0;
    const tankShare = team.damageTaken > 0 ? p.damageTaken / team.damageTaken : 0;
    const objectiveShare = team.objectiveDamage > 0 ? p.objectiveDamage / team.objectiveDamage : 0;

    // Weighted score components
    const score =
      Math.min(kda, 15) * 2.0 +        // KDA (capped at 15)
      killPart * 100 * 1.5 +             // Kill participation %
      damageShare * 100 * 2.0 +          // Damage share %
      tankShare * 100 * 1.0 +            // Tank share %
      p.visionScore * 0.3 +             // Vision score
      objectiveShare * 100 * 1.0 +       // Objective damage share
      (p.cs / 10) * 0.5;                // CS contribution

    return { ...p, mvpScore: score, killParticipation: killPart * 100 };
  });

  // Normalize to 0-10 scale
  const maxScore = Math.max(...scored.map((p) => p.mvpScore));
  const minScore = Math.min(...scored.map((p) => p.mvpScore));
  const range = maxScore - minScore || 1;

  const normalized = scored.map((p) => ({
    ...p,
    mvpScore: Math.round(((p.mvpScore - minScore) / range) * 100) / 10, // 0.0 ~ 10.0
  }));

  // Determine MVP (best on winning team) and ACE (best on losing team)
  const winners = normalized.filter((p) => p.win);
  const losers = normalized.filter((p) => !p.win);

  const mvp = winners.length > 0
    ? winners.reduce((a, b) => (a.mvpScore > b.mvpScore ? a : b))
    : null;
  const ace = losers.length > 0
    ? losers.reduce((a, b) => (a.mvpScore > b.mvpScore ? a : b))
    : null;

  return normalized.map((p) => ({
    ...p,
    isMvp: mvp ? p.nickname === mvp.nickname && p.team === mvp.team : false,
    isAce: ace ? p.nickname === ace.nickname && p.team === ace.team : false,
  }));
}

function getTeamTotals(team: PlayerStat[]) {
  return {
    kills: team.reduce((s, p) => s + p.kills, 0),
    damage: team.reduce((s, p) => s + p.damageDealt, 0),
    damageTaken: team.reduce((s, p) => s + p.damageTaken, 0),
    objectiveDamage: team.reduce((s, p) => s + p.objectiveDamage, 0),
  };
}

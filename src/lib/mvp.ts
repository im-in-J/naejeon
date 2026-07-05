import type { PlayerStat } from "./types";

/**
 * 매치 내 기여도 점수 (0~10)
 *
 * op.gg OP Score 방식을 따름:
 * - 팀 대비가 아니라 게임 참가자 10명 전체 대비로 평가
 *   (팀 대비로 하면 진 팀에서 혼자 잘한 선수가 과대평가됨)
 * - 각 지표를 "게임 평균 대비 배율"로 환산 → 5.0이 평균, 10.0이 상한
 *   (min-max 정규화처럼 매판 무조건 0점/10점이 나오지 않음)
 * - MVP = 이긴 팀 중 최고점, ACE = 진 팀 중 최고점
 */
export function calculateMvpScores(players: PlayerStat[]): PlayerStat[] {
  if (players.length === 0) return players;

  const count = players.length;

  // 게임 전체(10명) 합계
  const total = {
    damage: players.reduce((s, p) => s + (p.damageDealt || 0), 0),
    damageTaken: players.reduce((s, p) => s + (p.damageTaken || 0), 0),
    objectiveDamage: players.reduce((s, p) => s + (p.objectiveDamage || 0), 0),
    vision: players.reduce((s, p) => s + (p.visionScore || 0), 0),
    cs: players.reduce((s, p) => s + (p.cs || 0), 0),
  };

  const teamKills = {
    blue: players.filter((p) => p.team === "blue").reduce((s, p) => s + p.kills, 0),
    red: players.filter((p) => p.team === "red").reduce((s, p) => s + p.kills, 0),
  };

  const kdaOf = (p: PlayerStat) =>
    p.deaths === 0 ? (p.kills + p.assists) * 1.2 : (p.kills + p.assists) / p.deaths;
  const kpOf = (p: PlayerStat) => {
    const tk = teamKills[p.team];
    return tk > 0 ? (p.kills + p.assists) / tk : 0;
  };

  const avgKda = players.reduce((s, p) => s + kdaOf(p), 0) / count || 1;
  const avgKp = players.reduce((s, p) => s + kpOf(p), 0) / count || 1;

  // 게임 평균 대비 배율 (1.0 = 평균, 2.5 캡 — 한 지표 몰빵 방지)
  const CAP = 2.5;
  const shareRatio = (value: number, totalSum: number) =>
    totalSum > 0 ? Math.min((value / totalSum) * count, CAP) : 1;

  const scored = players.map((p) => {
    const kdaRatio = Math.min(kdaOf(p) / avgKda, CAP);
    const kpRatio = Math.min(kpOf(p) / avgKp, CAP);

    // 역할군 편향 없이 캐리(딜·CS), 탱커(받은 피해), 서포터(시야·킬관여)가
    // 모두 점수를 받을 수 있는 가중 구성
    const composite =
      shareRatio(p.damageDealt || 0, total.damage) * 0.25 +
      kdaRatio * 0.2 +
      kpRatio * 0.15 +
      shareRatio(p.objectiveDamage || 0, total.objectiveDamage) * 0.1 +
      shareRatio(p.damageTaken || 0, total.damageTaken) * 0.1 +
      shareRatio(p.visionScore || 0, total.vision) * 0.1 +
      shareRatio(p.cs || 0, total.cs) * 0.1;

    const score = Math.min(Math.max(composite * 5, 0), 10);

    return {
      ...p,
      mvpScore: Math.round(score * 10) / 10,
      killParticipation: kpOf(p) * 100,
    };
  });

  // MVP = 이긴 팀 최고점, ACE = 진 팀 최고점 (op.gg 기준과 동일)
  const winners = scored.filter((p) => p.win);
  const losers = scored.filter((p) => !p.win);

  const mvp = winners.length > 0
    ? winners.reduce((a, b) => (a.mvpScore > b.mvpScore ? a : b))
    : null;
  const ace = losers.length > 0
    ? losers.reduce((a, b) => (a.mvpScore > b.mvpScore ? a : b))
    : null;

  return scored.map((p) => ({
    ...p,
    isMvp: mvp ? p.nickname === mvp.nickname && p.team === mvp.team : false,
    isAce: ace ? p.nickname === ace.nickname && p.team === ace.team : false,
  }));
}

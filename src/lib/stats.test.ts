import { describe, it, expect } from "vitest";
import {
  buildPlayerStats,
  buildChampionStats,
  buildTeamSideStats,
  computeAwards,
} from "./stats";
import type { Group, Match, PlayerStat } from "./types";

// ─── Fixture helpers ───

let seq = 0;

function ps(o: Partial<PlayerStat> & { nickname: string; team: "blue" | "red"; win: boolean }): PlayerStat {
  return {
    id: `p${seq++}`,
    matchId: "",
    champion: "Ahri",
    team: o.team,
    nickname: o.nickname,
    win: o.win,
    kills: 0,
    deaths: 0,
    assists: 0,
    cs: 0,
    gold: 0,
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
    ...o,
  };
}

function match(players: PlayerStat[], opts: { id?: string; duration?: string; bans?: Match["bans"] } = {}): Match {
  const id = opts.id ?? `m${seq++}`;
  return {
    id,
    groupId: "g",
    createdAt: new Date(2026, 0, 1, 0, seq).toISOString(),
    gameDuration: opts.duration ?? "30:00",
    players: players.map((p) => ({ ...p, matchId: id })),
    bans: opts.bans,
  };
}

function group(matches: Match[]): Group {
  return { id: "g", name: "test", inviteCode: "x", createdAt: "", members: [], matches };
}

/** duel match: home(blue) vs away(red), home wins iff homeWin */
function duel(home: string, away: string, homeWin: boolean, extra: Partial<PlayerStat> = {}): Match {
  return match([
    ps({ nickname: home, team: "blue", win: homeWin, ...extra }),
    ps({ nickname: away, team: "red", win: !homeWin }),
  ]);
}

// ─── buildPlayerStats ───

describe("buildPlayerStats", () => {
  it("computes win rate and games played", () => {
    const g = group([duel("A", "B", true), duel("A", "B", true), duel("A", "B", false)]);
    const a = buildPlayerStats(g).find((p) => p.nickname === "A")!;
    expect(a.gamesPlayed).toBe(3);
    expect(a.wins).toBe(2);
    expect(a.losses).toBe(1);
    expect(a.winRate).toBeCloseTo(66.67, 1);
  });

  it("handles zero-death KDA without dividing by zero", () => {
    const g = group([duel("A", "B", true, { kills: 5, assists: 5, deaths: 0 })]);
    const a = buildPlayerStats(g).find((p) => p.nickname === "A")!;
    expect(a.avgKda).toBeCloseTo((5 + 5) * 1.2, 5);
    expect(Number.isFinite(a.avgKda)).toBe(true);
  });

  it("momentum is null when player has fewer than 8 games", () => {
    const g = group(Array.from({ length: 7 }, () => duel("A", "B", true)));
    const a = buildPlayerStats(g).find((p) => p.nickname === "A")!;
    expect(a.momentum).toBeNull();
  });

  it("momentum is +100 when last 5 games won and earlier games lost", () => {
    // 10 games: first 5 losses, last 5 wins
    const matches = [
      ...Array.from({ length: 5 }, () => duel("A", "B", false)),
      ...Array.from({ length: 5 }, () => duel("A", "B", true)),
    ];
    const a = buildPlayerStats(group(matches)).find((p) => p.nickname === "A")!;
    expect(a.momentum).toBeCloseTo(100, 5);
  });

  it("momentum is negative when recent form dips", () => {
    const matches = [
      ...Array.from({ length: 5 }, () => duel("A", "B", true)),
      ...Array.from({ length: 5 }, () => duel("A", "B", false)),
    ];
    const a = buildPlayerStats(group(matches)).find((p) => p.nickname === "A")!;
    expect(a.momentum).toBeCloseTo(-100, 5);
  });

  it("csPerMin uses fallback 30min for malformed duration", () => {
    const g = group([match(
      [ps({ nickname: "A", team: "blue", win: true, cs: 300 }), ps({ nickname: "B", team: "red", win: false })],
      { duration: "garbage" }
    )]);
    const a = buildPlayerStats(g).find((p) => p.nickname === "A")!;
    expect(a.csPerMin).toBeCloseTo(300 / 30, 5);
  });

  it("sorts results by totalScore descending and keeps score in 0..100", () => {
    const matches = [
      ...Array.from({ length: 6 }, () => duel("A", "B", true, { kills: 10, assists: 10, deaths: 1 })),
      ...Array.from({ length: 6 }, () => duel("A", "B", false)),
    ];
    const res = buildPlayerStats(group(matches));
    for (const r of res) {
      expect(r.totalScore).toBeGreaterThanOrEqual(0);
      expect(r.totalScore).toBeLessThanOrEqual(100);
    }
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].totalScore).toBeGreaterThanOrEqual(res[i].totalScore);
    }
  });
});

// ─── computeAwards ───

describe("computeAwards", () => {
  it("does not include duo-related or 내전 중독 awards", () => {
    const matches = Array.from({ length: 25 }, () => duel("A", "B", true, { kills: 5, cs: 200 }));
    const titles = computeAwards(group(matches)).map((a) => a.title);
    expect(titles).not.toContain("베스트 듀오");
    expect(titles).not.toContain("워스트 듀오");
    expect(titles).not.toContain("견우와 직녀");
    expect(titles).not.toContain("내전 중독");
  });

  it("only considers the most recent 20 matches", () => {
    // match 1: Ghost plays (and would be a perfect winner) but is outside the window
    const ghostMatch = duel("Ghost", "Filler", true);
    // matches 2..21: Recent beats Filler every time
    const recentMatches = Array.from({ length: 20 }, () => duel("Recent", "Filler", true));
    const awards = computeAwards(group([ghostMatch, ...recentMatches]));
    // Ghost is outside the 20-game window → never awarded
    expect(awards.every((a) => a.player !== "Ghost")).toBe(true);
    // 승률왕 should be the in-window perfect winner
    const wr = awards.find((a) => a.title === "승률왕");
    expect(wr?.player).toBe("Recent");
  });

  it("returns no awards for an empty group", () => {
    expect(computeAwards(group([]))).toEqual([]);
  });
});

// ─── buildChampionStats ───

describe("buildChampionStats", () => {
  it("aggregates per-champion win rate and sorts by games", () => {
    const matches = [
      match([ps({ nickname: "A", team: "blue", win: true, champion: "Yasuo" }), ps({ nickname: "B", team: "red", win: false, champion: "Teemo" })]),
      match([ps({ nickname: "A", team: "blue", win: true, champion: "Yasuo" }), ps({ nickname: "B", team: "red", win: false, champion: "Garen" })]),
      match([ps({ nickname: "A", team: "blue", win: false, champion: "Yasuo" }), ps({ nickname: "B", team: "red", win: true, champion: "Garen" })]),
    ];
    const stats = buildChampionStats(group(matches));
    expect(stats[0].champion).toBe("Yasuo"); // most games → first
    const yasuo = stats.find((c) => c.champion === "Yasuo")!;
    expect(yasuo.totalGames).toBe(3);
    expect(yasuo.winRate).toBeCloseTo(66.67, 1);
  });

  it("includes ban-only champions with a ban rate and zero games", () => {
    const m = match(
      [ps({ nickname: "A", team: "blue", win: true, champion: "Ahri" }), ps({ nickname: "B", team: "red", win: false, champion: "Ahri" })],
      { bans: { blue: ["Zed"], red: [] } }
    );
    const stats = buildChampionStats(group([m]));
    const zed = stats.find((c) => c.champion === "Zed")!;
    expect(zed).toBeDefined();
    expect(zed.totalGames).toBe(0);
    expect(zed.banCount).toBe(1);
    expect(zed.banRate).toBeCloseTo(100, 5);
  });
});

// ─── buildTeamSideStats ───

describe("buildTeamSideStats", () => {
  it("computes blue/red overall win rates", () => {
    const matches = [
      match([ps({ nickname: "A", team: "blue", win: true }), ps({ nickname: "C", team: "red", win: false })]),
      match([ps({ nickname: "A", team: "blue", win: true }), ps({ nickname: "C", team: "red", win: false })]),
    ];
    const { overall } = buildTeamSideStats(group(matches));
    const blue = overall.find((o) => o.team === "blue")!;
    expect(blue.winRate).toBeCloseTo(100, 5);
  });

  it("tracks same-team duos and head-to-head rivals", () => {
    // Anna & Bob together on blue twice (both wins); Anna vs Cara on opposite twice
    const matches = [
      match([
        ps({ nickname: "Anna", team: "blue", win: true }),
        ps({ nickname: "Bob", team: "blue", win: true }),
        ps({ nickname: "Cara", team: "red", win: false }),
      ]),
      match([
        ps({ nickname: "Anna", team: "blue", win: true }),
        ps({ nickname: "Bob", team: "blue", win: true }),
        ps({ nickname: "Cara", team: "red", win: false }),
      ]),
    ];
    const { duos } = buildTeamSideStats(group(matches));
    const annaBob = duos.find(
      (d) => [d.player1, d.player2].sort().join() === ["Anna", "Bob"].sort().join()
    )!;
    expect(annaBob.sameTeamGames).toBe(2);
    expect(annaBob.sameTeamWinRate).toBeCloseTo(100, 5);

    const annaCara = duos.find(
      (d) => [d.player1, d.player2].sort().join() === ["Anna", "Cara"].sort().join()
    )!;
    expect(annaCara.oppositeGames).toBe(2);
    // player1 is alphabetically first (Anna), who won both head-to-heads
    expect(annaCara.player1).toBe("Anna");
    expect(annaCara.player1Wins).toBe(2);
  });
});

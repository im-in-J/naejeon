"use client";

import { useState, useMemo } from "react";
import { StatTable, stickyHead } from "@/components/ui/stat-table";
import { Modal } from "@/components/ui/modal";
import { SearchInput } from "@/components/ui/search-input";
import { ChampionIcon } from "@/components/ui/champion-icon";
import { buildChampionStats, type ChampionStats } from "@/lib/stats";
import type { Group, Lane } from "@/lib/types";

type ViewMode = "tierlist" | "table";
type LaneFilter = "all" | Lane;

const LANE_TABS: { key: LaneFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "top", label: "🛡️ 탑" },
  { key: "jungle", label: "🌿 정글" },
  { key: "mid", label: "🔥 미드" },
  { key: "adc", label: "🏹 원딜" },
  { key: "support", label: "💚 서폿" },
];

interface TierDef {
  tier: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  min: number;
  max: number;
}

const TIERS: TierDef[] = [
  { tier: "S", label: "S 티어", color: "text-red-400", bg: "bg-red-500/8", border: "border-red-500/20", min: 75, max: 999 },
  { tier: "A", label: "A 티어", color: "text-orange-400", bg: "bg-orange-500/8", border: "border-orange-500/20", min: 60, max: 75 },
  { tier: "B", label: "B 티어", color: "text-yellow-400", bg: "bg-yellow-500/8", border: "border-yellow-500/20", min: 45, max: 60 },
  { tier: "C", label: "C 티어", color: "text-blue-400", bg: "bg-blue-500/8", border: "border-blue-500/20", min: 30, max: 45 },
  { tier: "D", label: "D 티어", color: "text-ink-subtle", bg: "bg-surface-2", border: "border-hairline", min: 0, max: 30 },
];

// 티어 점수: 승률 60% + KDA 40% → 0~100 스케일
function getTierScore(champ: ChampionStats): number {
  const wrScore = champ.winRate; // 0~100
  const kdaCapped = Math.min(champ.avgKda, 8); // 8 이상은 cap
  const kdaScore = (kdaCapped / 8) * 100; // 0~100
  return wrScore * 0.6 + kdaScore * 0.4;
}

// 정렬용 순위 점수: 판수를 반영한 보정 승률 (1판 100%가 10판 60%보다 위로 가지 않게)
function getRankScore(champ: ChampionStats): number {
  const smoothedWR = ((champ.wins + 2.5) / (champ.totalGames + 5)) * 100;
  const kdaScore = (Math.min(champ.avgKda, 8) / 8) * 100;
  return smoothedWR * 0.6 + kdaScore * 0.4;
}

function getChampTier(champ: ChampionStats): TierDef {
  if (champ.totalGames === 1) return TIERS[2]; // 데이터 부족 → B
  const score = getTierScore(champ);
  for (const t of TIERS) {
    if (score >= t.min && score < t.max) return t;
  }
  return TIERS[4];
}

export function ChampionStatsTab({ group }: { group: Group }) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("table");
  const [lane, setLane] = useState<LaneFilter>("all");
  const [selected, setSelected] = useState<ChampionStats | null>(null);

  const championStats = useMemo(
    () => buildChampionStats(group, lane === "all" ? undefined : lane),
    [group, lane]
  );

  const filtered = useMemo(() => {
    if (!search) return championStats;
    return championStats.filter((c) => c.champion.toLowerCase().includes(search.toLowerCase()));
  }, [championStats, search]);

  const tierGroups = useMemo(() => {
    return TIERS.map((tier) => ({
      ...tier,
      champions: filtered
        .filter((c) => c.totalGames > 0 && getChampTier(c).tier === tier.tier)
        .sort((a, b) => getRankScore(b) - getRankScore(a)),
    }));
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Lane Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {LANE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setLane(t.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-fast ${
              lane === t.key
                ? "bg-primary/15 text-primary"
                : "text-ink-subtle hover:text-ink hover:bg-surface-1"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <SearchInput
          className="flex-1 max-w-xs"
          placeholder="챔피언 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-1 bg-surface-1 border border-hairline rounded-lg p-0.5">
          <button
            onClick={() => setView("tierlist")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-fast cursor-pointer ${
              view === "tierlist" ? "bg-surface-3 text-ink" : "text-ink-subtle hover:text-ink"
            }`}
          >
            티어리스트
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-fast cursor-pointer ${
              view === "table" ? "bg-surface-3 text-ink" : "text-ink-subtle hover:text-ink"
            }`}
          >
            테이블
          </button>
        </div>
      </div>

      {view === "tierlist" ? (
        /* ─── Tier List View ─── */
        <div className="space-y-1">
          {tierGroups.map((group) => (
            <div
              key={group.tier}
              className={`flex border ${group.border} rounded-lg overflow-hidden min-h-[60px]`}
            >
              {/* Tier Label */}
              <div className={`${group.bg} flex items-center justify-center w-14 sm:w-20 shrink-0 border-r ${group.border}`}>
                <span className={`text-2xl sm:text-3xl font-bold ${group.color}`}>
                  {group.tier}
                </span>
              </div>

              {/* Champions */}
              <div className="flex-1 flex flex-wrap items-center gap-2 p-3">
                {group.champions.length === 0 ? (
                  <span className="text-xs text-ink-tertiary">해당 챔피언 없음</span>
                ) : (
                  group.champions.map((champ) => (
                    <button
                      key={champ.champion}
                      onClick={() => setSelected(champ)}
                      className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-surface-1 hover:bg-surface-2 border border-hairline hover:border-hairline-strong transition-fast cursor-pointer min-w-[160px]"
                    >
                      <ChampionIcon name={champ.champion} size={40} className="rounded-lg" />
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink truncate">{champ.champion}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-bold ${champ.winRate >= 55 ? "text-win" : champ.winRate < 45 ? "text-lose" : "text-ink-muted"}`}>
                            {champ.winRate.toFixed(0)}%
                          </span>
                          <span className={`text-xs ${champ.avgKda >= 3.5 ? "text-win/80" : champ.avgKda < 2 ? "text-lose/60" : "text-ink-subtle"}`}>
                            {champ.avgKda.toFixed(1)} KDA
                          </span>
                          <span className="text-[11px] text-ink-tertiary">{champ.totalGames}판</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ─── Table View ─── */
        <StatTable>
              <thead className={stickyHead}>
                <tr className="text-ink-subtle text-xs border-b border-hairline">
                  <th className="text-center py-2.5 px-3 w-12">티어</th>
                  <th className="text-left py-2.5 px-3">챔피언</th>
                  <th className="text-center py-2.5 px-2">판수</th>
                  <th className="text-center py-2.5 px-2">승률</th>
                  <th className="text-center py-2.5 px-2">KDA</th>
                  <th className="text-center py-2.5 px-2">K/D/A</th>
                  <th className="text-center py-2.5 px-2">CS</th>
                  <th className="text-center py-2.5 px-2">밴</th>
                  <th className="text-left py-2.5 px-2">플레이어</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered]
                  .sort((a, b) => {
                    // 픽 기록 있는 챔피언 먼저 → 티어 높은순 → 같은 티어 안에서는 판수 보정 승률순
                    const pickDiff = (a.totalGames > 0 ? 0 : 1) - (b.totalGames > 0 ? 0 : 1);
                    if (pickDiff !== 0) return pickDiff;
                    if (a.totalGames === 0) return b.banCount - a.banCount;
                    const tierDiff =
                      TIERS.findIndex((t) => t.tier === getChampTier(a).tier) -
                      TIERS.findIndex((t) => t.tier === getChampTier(b).tier);
                    return tierDiff !== 0 ? tierDiff : getRankScore(b) - getRankScore(a);
                  })
                  .map((champ) => {
                    const tier = getChampTier(champ);
                    const banOnly = champ.totalGames === 0;
                    return (
                      <tr
                        key={champ.champion}
                        className="border-b border-hairline/50 hover:bg-surface-1 transition-fast cursor-pointer"
                        onClick={() => setSelected(champ)}
                      >
                        <td className="text-center py-2.5 px-3">
                          {banOnly ? (
                            <span className="text-xs text-ink-tertiary">-</span>
                          ) : (
                            <span className={`text-sm font-bold ${tier.color}`}>{tier.tier}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <ChampionIcon name={champ.champion} size={28} />
                            <span className="font-medium text-ink">{champ.champion}</span>
                          </div>
                        </td>
                        <td className="text-center py-2.5 px-2 text-ink-muted">
                          {banOnly ? "-" : champ.totalGames}
                        </td>
                        <td className="text-center py-2.5 px-2">
                          {banOnly ? (
                            <span className="text-ink-tertiary">-</span>
                          ) : (
                            <span className={`font-semibold ${champ.winRate >= 55 ? "text-win" : champ.winRate < 45 ? "text-lose" : "text-ink"}`}>
                              {champ.winRate.toFixed(0)}%
                            </span>
                          )}
                        </td>
                        <td className="text-center py-2.5 px-2">
                          {banOnly ? (
                            <span className="text-ink-tertiary">-</span>
                          ) : (
                            <span className={champ.avgKda >= 3.5 ? "text-win" : champ.avgKda < 2 ? "text-lose" : "text-ink"}>
                              {champ.avgKda.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="text-center py-2.5 px-2 text-ink-muted text-xs font-mono">
                          {banOnly ? "-" : `${champ.avgKills.toFixed(1)}/${champ.avgDeaths.toFixed(1)}/${champ.avgAssists.toFixed(1)}`}
                        </td>
                        <td className="text-center py-2.5 px-2 text-ink-muted">
                          {banOnly ? "-" : Math.round(champ.avgCs)}
                        </td>
                        <td className="text-center py-2.5 px-2">
                          {champ.banCount > 0 ? (
                            <span className="text-xs">
                              <span className="text-lose font-semibold">{champ.banCount}회</span>
                              <span className="text-ink-tertiary ml-1">({champ.banRate.toFixed(0)}%)</span>
                            </span>
                          ) : (
                            <span className="text-ink-tertiary text-xs">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-1">
                            {champ.players.slice(0, 3).map((p) => (
                              <span key={p.nickname} className="text-xs text-ink-subtle px-1.5 py-0.5 rounded bg-surface-2">
                                {p.nickname}
                              </span>
                            ))}
                            {champ.players.length > 3 && (
                              <span className="text-[10px] text-ink-tertiary">+{champ.players.length - 3}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
        </StatTable>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-ink-subtle">
          {search
            ? "검색 결과가 없습니다"
            : lane !== "all"
              ? "해당 라인에 기록된 챔피언이 없습니다"
              : "아직 기록된 챔피언이 없습니다"}
        </div>
      )}

      {/* Tier Criteria */}
      <div className="border border-hairline rounded-lg overflow-hidden">
        <div className="bg-canvas px-4 py-2.5 border-b border-hairline">
          <span className="text-xs font-semibold text-ink-muted">티어 선정 기준</span>
        </div>
        <div className="px-4 py-3 space-y-2.5 text-xs text-ink-subtle">
          <p className="text-ink-muted">
            티어 점수 = <span className="text-ink font-mono">승률 × 60%</span> + <span className="text-ink font-mono">KDA 점수 × 40%</span>
            <span className="text-ink-tertiary"> (KDA는 8.0 이상 cap)</span>
          </p>
          <div className="grid grid-cols-5 gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-red-400 font-bold text-sm">S</span>
              <span>75점 이상</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-orange-400 font-bold text-sm">A</span>
              <span>60 ~ 75</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400 font-bold text-sm">B</span>
              <span>45 ~ 60</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-blue-400 font-bold text-sm">C</span>
              <span>30 ~ 45</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-ink-subtle font-bold text-sm">D</span>
              <span>30 미만</span>
            </div>
          </div>
          <p className="text-ink-tertiary">
            1판만 플레이한 챔피언은 데이터 부족으로 B 티어에 배치됩니다.
            테이블 정렬은 판수를 반영한 보정 승률 기준이라 판수가 적은 챔피언은 아래로 밀립니다.
          </p>
        </div>
      </div>

      {/* Champion Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.champion}
        className="max-w-md"
      >
        {selected && <ChampionDetail champ={selected} />}
      </Modal>
    </div>
  );
}

function ChampionDetail({ champ }: { champ: ChampionStats }) {
  const tier = getChampTier(champ);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ChampionIcon name={champ.champion} size={48} className="rounded-lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-ink">{champ.champion}</span>
            {champ.totalGames > 0 && <span className={`text-sm font-bold ${tier.color}`}>{tier.tier} 티어</span>}
          </div>
          <div className="text-sm text-ink-subtle">
            {champ.totalGames > 0
              ? `${champ.totalGames}판 · ${champ.wins}승 ${champ.totalGames - champ.wins}패`
              : "픽 기록 없음"}
            {champ.banCount > 0 && (
              <span className="text-lose"> · 밴 {champ.banCount}회 ({champ.banRate.toFixed(0)}%)</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {champ.totalGames > 0 && (
      <div className="grid grid-cols-4 gap-2">
        <StatBox label="승률" value={`${champ.winRate.toFixed(0)}%`} color={champ.winRate >= 50 ? "text-win" : "text-lose"} />
        <StatBox label="KDA" value={champ.avgKda.toFixed(2)} color={champ.avgKda >= 3 ? "text-win" : undefined} />
        <StatBox label="CS" value={`${Math.round(champ.avgCs)}`} />
        <StatBox label="골드" value={`${Math.round(champ.avgGold).toLocaleString()}`} />
      </div>
      )}

      {champ.totalGames > 0 && (
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="평균 킬" value={champ.avgKills.toFixed(1)} />
        <StatBox label="평균 데스" value={champ.avgDeaths.toFixed(1)} color="text-lose/80" />
        <StatBox label="평균 어시" value={champ.avgAssists.toFixed(1)} />
      </div>
      )}

      {/* Players */}
      {champ.players.length > 0 && (
        <div>
          <div className="text-xs text-ink-subtle mb-2">플레이어별 전적</div>
          <div className="space-y-1">
            {champ.players.map((p) => (
              <div key={p.nickname} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-md bg-surface-2/50">
                <span className="text-ink font-medium">{p.nickname}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-ink-subtle">{p.games}판</span>
                  <span className={`font-semibold ${p.winRate >= 50 ? "text-win" : "text-lose"}`}>
                    {p.winRate.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-2/50 rounded-md p-2.5 text-center">
      <div className="text-[10px] text-ink-tertiary">{label}</div>
      <div className={`text-sm font-semibold mt-0.5 ${color || "text-ink"}`}>{value}</div>
    </div>
  );
}

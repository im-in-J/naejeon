"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Crown, Search } from "lucide-react";
import type { PlayerStats, Award } from "@/lib/stats";

type SortKey =
  | "totalScore" | "winRate" | "avgKda" | "csPerMin" | "avgVision"
  | "avgKillParticipation" | "damagePerGold" | "mvpCount" | "gamesPlayed";

const MULTIKILL_LABEL: Record<number, string> = {
  2: "더블킬", 3: "트리플킬", 4: "쿼드라킬", 5: "펜타킬",
};

export function PlayerStatsTab({
  playerStats,
  awards,
}: {
  playerStats: PlayerStats[];
  awards: Award[];
}) {
  const [sortBy, setSortBy] = useState<SortKey>("totalScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [search, setSearch] = useState("");

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(false);
    }
  };

  const sorted = [...playerStats].sort((a, b) => {
    const diff = (a[sortBy] as number) - (b[sortBy] as number);
    return sortAsc ? diff : -diff;
  });

  // 검색해도 순위(#)는 전체 기준 유지
  const query = search.trim().toLowerCase();
  const visible = sorted
    .map((entry, rank) => ({ entry, rank }))
    .filter(({ entry }) => !query || entry.nickname.toLowerCase().includes(query));

  const SortTh = ({ label, sortKey, title }: { label: string; sortKey: SortKey; title?: string }) => (
    <th
      className="text-center py-3 px-2 cursor-pointer select-none hover:text-ink transition-fast whitespace-nowrap"
      title={title}
      onClick={() => handleSort(sortKey)}
    >
      {label}
      <span className={`ml-0.5 text-[9px] ${sortBy === sortKey ? "text-primary" : "text-transparent"}`}>
        {sortBy === sortKey && sortAsc ? "▲" : "▼"}
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* Awards — 3-row grid */}
      {awards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {awards.map((award) => (
            <div
              key={award.title}
              className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-surface-1 border border-hairline"
            >
              <span className="text-2xl shrink-0">{award.emoji}</span>
              <div className="min-w-0">
                <div className="text-xs text-ink-subtle">{award.title}</div>
                <div className="text-sm font-semibold text-ink truncate">{award.player}</div>
                <div className="text-xs text-ink-muted">{award.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="선수 검색"
            className="w-44 rounded-lg bg-surface-1 border border-hairline pl-8 pr-3 py-1.5 text-sm text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-primary-hover/50 transition-fast"
          />
        </div>
      </div>

      {/* Leaderboard */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs border-b border-border bg-bg-secondary/50">
                <th className="text-center py-3 px-2 w-10">#</th>
                <th className="text-left py-3 px-3">플레이어</th>
                <SortTh label="경기" sortKey="gamesPlayed" />
                <SortTh label="승률" sortKey="winRate" />
                <SortTh label="KDA" sortKey="avgKda" />
                <SortTh label="분당 CS" sortKey="csPerMin" />
                <SortTh label="시야점수" sortKey="avgVision" />
                <SortTh label="킬관여율" sortKey="avgKillParticipation" />
                <SortTh label="골드당 딜" sortKey="damagePerGold" />
                <SortTh label="MVP/ACE" sortKey="mvpCount" />
                <SortTh
                  label="점수"
                  sortKey="totalScore"
                  title="그룹 내 백분위 가중합 (0~100): 승률(판수 보정) 30% + MVP/ACE 15% + KDA 10% + 킬관여 10% + 분당CS 10% + 시야 10% + 골드당 딜 10% + 판수 5%, 판수가 적으면 신뢰도 계수로 감점"
                />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-text-muted text-sm">
                    &quot;{search}&quot; 검색 결과가 없습니다
                  </td>
                </tr>
              )}
              {visible.map(({ entry, rank }) => (
                <tr
                  key={entry.nickname}
                  className="border-b border-border/30 hover:bg-bg-card-hover/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedPlayer(entry)}
                >
                  <td className="text-center py-3 px-2">
                    <span className={`font-bold ${rank === 0 ? "rank-1 text-base" : rank === 1 ? "rank-2" : rank === 2 ? "rank-3" : "text-text-muted"}`}>
                      {rank + 1}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-text-primary flex items-center gap-1.5">
                      {rank === 0 && <Crown size={14} className="text-gold" />}
                      {entry.nickname}
                    </div>
                  </td>
                  <td className="text-center py-3 px-2 text-text-secondary">
                    <span>{entry.gamesPlayed}</span>
                    <span className="text-text-muted text-xs ml-1">({entry.wins}W {entry.losses}L)</span>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className={entry.winRate >= 55 ? "text-win font-bold" : entry.winRate < 45 ? "text-lose" : "text-text-primary"}>
                      {entry.winRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className={entry.avgKda >= 3.5 ? "text-win font-bold" : entry.avgKda < 2 ? "text-lose" : "text-text-primary"}>
                      {entry.avgKda.toFixed(2)}
                    </span>
                  </td>
                  <td className="text-center py-3 px-2 text-text-primary">{entry.csPerMin.toFixed(1)}</td>
                  <td className="text-center py-3 px-2 text-text-secondary">{entry.avgVision.toFixed(1)}</td>
                  <td className="text-center py-3 px-2">
                    <span className={entry.avgKillParticipation >= 60 ? "text-win font-semibold" : "text-text-secondary"}>
                      {entry.avgKillParticipation.toFixed(0)}%
                    </span>
                  </td>
                  <td className="text-center py-3 px-2">
                    {entry.damagePerGold > 0 ? (
                      <span className={entry.damagePerGold >= 1.5 ? "text-win font-semibold" : "text-text-secondary"}>
                        {entry.damagePerGold.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="text-center py-3 px-2">
                    <div className="flex items-center justify-center gap-1">
                      {entry.mvpCount > 0 && <Badge variant="mvp">{entry.mvpCount}</Badge>}
                      {entry.aceCount > 0 && <Badge variant="ace">{entry.aceCount}</Badge>}
                      {entry.mvpCount === 0 && entry.aceCount === 0 && <span className="text-text-muted">-</span>}
                    </div>
                  </td>
                  <td className="text-center py-3 px-2">
                    <span className="font-bold text-accent">{entry.totalScore.toFixed(1)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Player Detail Modal */}
      <Modal
        open={!!selectedPlayer}
        onClose={() => setSelectedPlayer(null)}
        title={selectedPlayer?.nickname}
        className="max-w-2xl"
      >
        {selectedPlayer && <PlayerDetail player={selectedPlayer} />}
      </Modal>
    </div>
  );
}

function PlayerDetail({ player }: { player: PlayerStats }) {
  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="경기" value={`${player.gamesPlayed}`} />
        <MiniStat label="승률" value={`${player.winRate.toFixed(0)}%`} color={player.winRate >= 50 ? "text-win" : "text-lose"} />
        <MiniStat label="KDA" value={player.avgKda.toFixed(2)} color={player.avgKda >= 3 ? "text-win" : undefined} />
        <MiniStat label="MVP" value={`${player.mvpCount}`} color="text-gold" />
      </div>

      {/* Avg Stats */}
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="평균 K/D/A" value={`${player.avgKills.toFixed(1)} / ${player.avgDeaths.toFixed(1)} / ${player.avgAssists.toFixed(1)}`} />
        <MiniStat label="분당 CS" value={player.csPerMin.toFixed(1)} />
        <MiniStat label="분당 골드" value={`${Math.round(player.goldPerMin).toLocaleString()}`} />
        <MiniStat label="킬관여율" value={`${player.avgKillParticipation.toFixed(0)}%`} color={player.avgKillParticipation >= 60 ? "text-win" : undefined} />
      </div>

      <div className="grid grid-cols-5 gap-3">
        <MiniStat label="시야점수" value={player.avgVision.toFixed(1)} />
        <MiniStat label="골드당 딜" value={player.damagePerGold > 0 ? player.damagePerGold.toFixed(2) : "-"} color={player.damagePerGold >= 1.5 ? "text-win" : undefined} />
        <MiniStat label="평균 포탑딜" value={player.avgTurretDamage > 0 ? Math.round(player.avgTurretDamage).toLocaleString() : "-"} />
        <MiniStat label="선취점" value={player.firstBloodCount > 0 ? `${player.firstBloodCount}회` : "-"} />
        <MiniStat
          label="최대 멀티킬"
          value={player.bestMultiKill >= 2 ? MULTIKILL_LABEL[player.bestMultiKill] : "-"}
          color={player.bestMultiKill >= 4 ? "text-mvp" : undefined}
        />
      </div>

      {/* Recent form */}
      <div>
        <div className="text-xs text-text-muted mb-2">최근 전적</div>
        <div className="flex gap-1">
          {player.recentMatches.map((m, i) => (
            <div
              key={i}
              className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                m.win ? "bg-win/20 text-win" : "bg-lose/20 text-lose"
              }`}
            >
              {m.win ? "W" : "L"}
            </div>
          ))}
        </div>
      </div>

      {/* Lane stats */}
      {player.laneStats.length > 0 && (
        <div>
          <div className="text-xs text-text-muted mb-2">라인별 전적</div>
          <div className="grid grid-cols-5 gap-1.5">
            {player.laneStats.map((ls) => (
              <div key={ls.lane} className="bg-bg-secondary/50 rounded-lg p-2 text-center">
                <div className="text-xs mb-0.5">
                  {{ top: "🛡️", jungle: "🌿", mid: "🔥", adc: "🏹", support: "💚" }[ls.lane]}
                </div>
                <div className={`text-xs font-bold ${ls.winRate >= 50 ? "text-win" : "text-lose"}`}>
                  {ls.winRate.toFixed(0)}%
                </div>
                <div className="text-[10px] text-text-muted">{ls.games}판</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Champion pool */}
      {player.champions.length > 0 && (
        <div>
          <div className="text-xs text-text-muted mb-2">챔피언 풀</div>
          <div className="space-y-1.5">
            {player.champions.slice(0, 8).map((c) => (
              <div
                key={c.champion}
                className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-bg-secondary/50 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-text-primary w-20 truncate">{c.champion}</span>
                  <span className="text-text-muted text-xs">{c.games}판</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs ${c.winRate >= 50 ? "text-win" : "text-lose"}`}>
                    {c.winRate.toFixed(0)}%
                  </span>
                  <span className="text-text-secondary text-xs">
                    {c.avgKills.toFixed(1)}/{c.avgDeaths.toFixed(1)}/{c.avgAssists.toFixed(1)}
                  </span>
                  <span className="text-xs text-text-muted">KDA {c.avgKda.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-bg-secondary/50 rounded-lg p-2.5 text-center">
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
      <div className={`font-bold text-sm mt-0.5 ${color || "text-text-primary"}`}>{value}</div>
    </div>
  );
}

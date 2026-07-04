"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Crown } from "lucide-react";
import type { PlayerStats, Award } from "@/lib/stats";

type SortKey = "totalScore" | "winRate" | "avgKda" | "avgCs" | "avgGold" | "mvpCount" | "gamesPlayed";

export function PlayerStatsTab({
  playerStats,
  awards,
}: {
  playerStats: PlayerStats[];
  awards: Award[];
}) {
  const [sortBy, setSortBy] = useState<SortKey>("totalScore");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  const sorted = [...playerStats].sort((a, b) => {
    const aVal = a[sortBy] as number;
    const bVal = b[sortBy] as number;
    return bVal - aVal;
  });

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

      {/* Sort Tabs — compact pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {([
          ["totalScore", "종합"],
          ["winRate", "승률"],
          ["avgKda", "KDA"],
          ["gamesPlayed", "판수"],
          ["avgCs", "CS"],
          ["avgGold", "골드"],
          ["mvpCount", "MVP"],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-fast cursor-pointer whitespace-nowrap ${
              sortBy === key
                ? "bg-primary/15 text-primary"
                : "text-ink-subtle hover:text-ink hover:bg-surface-1"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs border-b border-border bg-bg-secondary/50">
                <th className="text-center py-3 px-2 w-10">#</th>
                <th className="text-left py-3 px-3">플레이어</th>
                <th className="text-center py-3 px-2">경기</th>
                <th className="text-center py-3 px-2">승률</th>
                <th className="text-center py-3 px-2">KDA</th>
                <th className="text-center py-3 px-2">평균 K/D/A</th>
                <th className="text-center py-3 px-2">CS</th>
                <th className="text-center py-3 px-2">골드</th>
                <th className="text-center py-3 px-2">MVP</th>
                <th className="text-center py-3 px-2">점수</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, i) => (
                <tr
                  key={entry.nickname}
                  className="border-b border-border/30 hover:bg-bg-card-hover/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedPlayer(entry)}
                >
                  <td className="text-center py-3 px-2">
                    <span className={`font-bold ${i === 0 ? "rank-1 text-base" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-text-muted"}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-text-primary flex items-center gap-1.5">
                      {i === 0 && <Crown size={14} className="text-gold" />}
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
                  <td className="text-center py-3 px-2 text-text-secondary text-xs">
                    {entry.avgKills.toFixed(1)} / {entry.avgDeaths.toFixed(1)} / {entry.avgAssists.toFixed(1)}
                  </td>
                  <td className="text-center py-3 px-2 text-text-primary">{Math.round(entry.avgCs)}</td>
                  <td className="text-center py-3 px-2 text-gold font-mono text-xs">
                    {Math.round(entry.avgGold).toLocaleString()}
                  </td>
                  <td className="text-center py-3 px-2">
                    {entry.mvpCount > 0 ? <Badge variant="mvp">{entry.mvpCount}</Badge> : <span className="text-text-muted">-</span>}
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
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="평균 K/D/A" value={`${player.avgKills.toFixed(1)} / ${player.avgDeaths.toFixed(1)} / ${player.avgAssists.toFixed(1)}`} />
        <MiniStat label="평균 CS" value={`${Math.round(player.avgCs)}`} />
        <MiniStat label="평균 골드" value={`${Math.round(player.avgGold).toLocaleString()}`} />
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

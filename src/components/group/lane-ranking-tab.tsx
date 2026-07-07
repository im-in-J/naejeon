"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { buildLaneRankings } from "@/lib/stats";
import type { PlayerStats } from "@/lib/stats";
import type { Lane } from "@/lib/types";

const LANE_META: Record<Lane, { label: string; emoji: string }> = {
  top: { label: "탑", emoji: "🛡️" },
  jungle: { label: "정글", emoji: "🌿" },
  mid: { label: "미드", emoji: "🔥" },
  adc: { label: "원딜", emoji: "🏹" },
  support: { label: "서포터", emoji: "💚" },
};

function rankColor(rank: number): string {
  return rank === 0 ? "rank-1" : rank === 1 ? "rank-2" : rank === 2 ? "rank-3" : "text-ink-tertiary";
}

export function LaneRankingTab({ playerStats }: { playerStats: PlayerStats[] }) {
  const rankings = useMemo(() => buildLaneRankings(playerStats), [playerStats]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-tertiary">
        포지션별로 해당 라인을 플레이한 선수를 <span className="text-ink-subtle">판수 보정 승률 + KDA</span> 기준으로 순위 매깁니다.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rankings.map(({ lane, entries }) => {
          const meta = LANE_META[lane];
          return (
            <Card key={lane} className="p-0 overflow-hidden">
              {/* Lane header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline bg-surface-1">
                <span className="text-lg leading-none">{meta.emoji}</span>
                <span className="text-sm font-semibold text-ink">{meta.label}</span>
                <span className="text-xs text-ink-tertiary ml-auto">{entries.length}명</span>
              </div>

              {/* Ranking rows */}
              {entries.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-ink-tertiary">기록 없음</div>
              ) : (
                <div className="divide-y divide-hairline/50">
                  {entries.map((e, rank) => (
                    <div key={e.nickname} className="flex items-center gap-2.5 px-4 py-2">
                      <span className={`w-5 text-center text-xs font-bold shrink-0 ${rankColor(rank)}`}>
                        {rank + 1}
                      </span>
                      <span className="flex-1 min-w-0 truncate text-sm font-medium text-ink">
                        {e.nickname}
                      </span>
                      <span className="text-[11px] text-ink-tertiary shrink-0">{e.games}판</span>
                      <span
                        className={`text-xs font-semibold w-10 text-right shrink-0 ${
                          e.winRate >= 55 ? "text-win" : e.winRate < 45 ? "text-lose" : "text-ink-muted"
                        }`}
                      >
                        {e.winRate.toFixed(0)}%
                      </span>
                      <span
                        className={`text-xs w-12 text-right shrink-0 ${
                          e.avgKda >= 3.5 ? "text-win/80" : e.avgKda < 2 ? "text-lose/70" : "text-ink-subtle"
                        }`}
                      >
                        {e.avgKda.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

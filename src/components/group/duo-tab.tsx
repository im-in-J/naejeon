"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { buildTeamSideStats, type DuoRecord } from "@/lib/stats";
import type { Group } from "@/lib/types";

// 게임 수 많은 사람이 목록을 독점하지 않도록 한 사람당 최대 3개 엔트리만 선정
function capPerPlayer(list: DuoRecord[], max = 3): DuoRecord[] {
  const count = new Map<string, number>();
  const out: DuoRecord[] = [];
  for (const d of list) {
    const c1 = count.get(d.player1) || 0;
    const c2 = count.get(d.player2) || 0;
    if (c1 >= max || c2 >= max) continue;
    count.set(d.player1, c1 + 1);
    count.set(d.player2, c2 + 1);
    out.push(d);
  }
  return out;
}

export function DuoTab({ group }: { group: Group }) {
  const duos = useMemo(() => buildTeamSideStats(group).duos, [group]);

  const bestDuos = capPerPlayer(
    duos
      .filter((d) => d.sameTeamGames >= 5)
      .sort((a, b) => b.sameTeamWinRate - a.sameTeamWinRate || b.sameTeamGames - a.sameTeamGames)
  );
  const rivals = capPerPlayer(
    duos.filter((d) => d.oppositeGames >= 2).sort((a, b) => b.oppositeGames - a.oppositeGames)
  );

  return (
    <div className="space-y-5">
      {/* Best duos */}
      <div>
        <div className="text-xs text-ink-subtle mb-2 font-medium">베스트 듀오 (같은 팀 승률 · 5판 이상 · 인당 최대 3개)</div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-subtle text-xs border-b border-hairline bg-canvas">
                  <th className="text-left py-2.5 px-3">듀오</th>
                  <th className="text-center py-2.5 px-2">함께한 경기</th>
                  <th className="text-center py-2.5 px-2">승률</th>
                  <th className="text-center py-2.5 px-2">전적</th>
                </tr>
              </thead>
              <tbody>
                {bestDuos.slice(0, 15).map((d, i) => (
                  <tr key={i} className="border-b border-hairline/30 hover:bg-surface-1 transition-fast">
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-ink">{d.player1}</span>
                      <span className="text-ink-tertiary mx-1.5">&</span>
                      <span className="font-medium text-ink">{d.player2}</span>
                    </td>
                    <td className="text-center py-2.5 px-2 text-ink-muted">{d.sameTeamGames}</td>
                    <td className="text-center py-2.5 px-2">
                      <span className={`font-semibold ${d.sameTeamWinRate >= 60 ? "text-win" : d.sameTeamWinRate < 40 ? "text-lose" : "text-ink"}`}>
                        {d.sameTeamWinRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-center py-2.5 px-2 text-ink-muted text-xs">
                      {d.sameTeamWins}W {d.sameTeamGames - d.sameTeamWins}L
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Rivals */}
      <div>
        <div className="text-xs text-ink-subtle mb-2 font-medium">라이벌 (적팀으로 만난 횟수 · 인당 최대 3개)</div>
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-ink-subtle text-xs border-b border-hairline bg-canvas">
                  <th className="text-left py-2.5 px-3">매치업</th>
                  <th className="text-center py-2.5 px-2">맞대결</th>
                  <th className="text-center py-2.5 px-2">상대 전적</th>
                </tr>
              </thead>
              <tbody>
                {rivals.slice(0, 15).map((d, i) => (
                  <tr key={i} className="border-b border-hairline/30 hover:bg-surface-1 transition-fast">
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-ink">{d.player1}</span>
                      <span className="text-ink-tertiary mx-1.5">vs</span>
                      <span className="font-medium text-ink">{d.player2}</span>
                    </td>
                    <td className="text-center py-2.5 px-2 text-ink-muted">{d.oppositeGames}회</td>
                    <td className="text-center py-2.5 px-2 text-xs">
                      <span className="text-ink">{d.player1}</span>
                      <span className="text-ink-muted mx-1">
                        {d.player1Wins}:{d.oppositeGames - d.player1Wins}
                      </span>
                      <span className="text-ink">{d.player2}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getGroup } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  Trophy,
  Flame,
  Shield,
  Eye,
  Swords,
  Target,
  Crown,
  Users,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { Group, PlayerStat, LeaderboardEntry } from "@/lib/types";

type SortKey = "totalScore" | "winRate" | "avgKda" | "avgDamage" | "avgVision" | "mvpCount";

export default function StatsPage() {
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("totalScore");

  const groupId = params.id as string;

  useEffect(() => {
    setGroup(getGroup(groupId));
  }, [groupId]);

  const leaderboard = useMemo(() => {
    if (!group) return [];
    return buildLeaderboard(group);
  }, [group]);

  const sorted = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      if (sortBy === "winRate") return b.winRate - a.winRate;
      if (sortBy === "avgKda") return b.avgKda - a.avgKda;
      if (sortBy === "avgDamage") return b.avgDamage - a.avgDamage;
      if (sortBy === "avgVision") return b.avgVision - a.avgVision;
      if (sortBy === "mvpCount") return b.mvpCount - a.mvpCount;
      return b.totalScore - a.totalScore;
    });
  }, [leaderboard, sortBy]);

  // Special awards
  const awards = useMemo(() => {
    if (!group || leaderboard.length === 0) return [];
    return computeAwards(group, leaderboard);
  }, [group, leaderboard]);

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">그룹을 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => router.push(`/group/${groupId}`)}
        className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-6 transition-fast cursor-pointer"
      >
        <ChevronLeft size={16} />
        그룹으로 돌아가기
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-2">{group.name} 통계</h1>
      <p className="text-sm text-text-muted mb-8">
        {group.matches.length}경기 · {leaderboard.length}명 참여
      </p>

      {/* Special Awards */}
      {awards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
          {awards.map((award) => (
            <Card key={award.title} className="text-center py-4 px-3">
              <div className="text-2xl mb-2">{award.emoji}</div>
              <div className="text-xs text-text-muted mb-1">{award.title}</div>
              <div className="font-bold text-text-primary text-sm">{award.player}</div>
              <div className="text-xs text-text-secondary mt-0.5">{award.value}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Sort Tabs */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {([
          ["totalScore", "종합"],
          ["winRate", "승률"],
          ["avgKda", "KDA"],
          ["avgDamage", "딜량"],
          ["avgVision", "시야"],
          ["mvpCount", "MVP"],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-fast cursor-pointer whitespace-nowrap ${
              sortBy === key
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-primary hover:bg-bg-card"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      {sorted.length === 0 ? (
        <Card className="text-center py-12">
          <Trophy size={40} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">아직 기록된 경기가 없습니다</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-xs border-b border-border bg-bg-secondary/50">
                  <th className="text-center py-3 px-3 w-12">#</th>
                  <th className="text-left py-3 px-3">플레이어</th>
                  <th className="text-center py-3 px-2">경기</th>
                  <th className="text-center py-3 px-2">승률</th>
                  <th className="text-center py-3 px-2">KDA</th>
                  <th className="text-center py-3 px-2">평균 딜량</th>
                  <th className="text-center py-3 px-2">평균 시야</th>
                  <th className="text-center py-3 px-2">MVP</th>
                  <th className="text-center py-3 px-2">ACE</th>
                  <th className="text-center py-3 px-2">점수</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <tr
                    key={entry.nickname}
                    className="border-b border-border/30 hover:bg-bg-card-hover/50 transition-colors"
                  >
                    <td className="text-center py-3 px-3">
                      <span
                        className={`font-bold ${
                          i === 0 ? "rank-1 text-lg" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-text-muted"
                        }`}
                      >
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
                      {entry.gamesPlayed}
                      <span className="text-text-muted text-xs ml-1">
                        ({entry.wins}W {entry.losses}L)
                      </span>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span
                        className={
                          entry.winRate >= 60
                            ? "text-win font-bold"
                            : entry.winRate < 40
                              ? "text-lose"
                              : "text-text-primary"
                        }
                      >
                        {entry.winRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-center py-3 px-2">
                      <span
                        className={
                          entry.avgKda >= 4
                            ? "text-win font-bold"
                            : entry.avgKda < 2
                              ? "text-lose"
                              : "text-text-primary"
                        }
                      >
                        {entry.avgKda.toFixed(2)}
                      </span>
                    </td>
                    <td className="text-center py-3 px-2 text-text-primary font-mono text-xs">
                      {Math.round(entry.avgDamage).toLocaleString()}
                    </td>
                    <td className="text-center py-3 px-2 text-text-primary">
                      {entry.avgVision.toFixed(1)}
                    </td>
                    <td className="text-center py-3 px-2">
                      {entry.mvpCount > 0 ? (
                        <Badge variant="mvp">{entry.mvpCount}</Badge>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-2">
                      {entry.aceCount > 0 ? (
                        <Badge variant="ace">{entry.aceCount}</Badge>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-2">
                      <span className="font-bold text-accent">
                        {entry.totalScore.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function buildLeaderboard(group: Group): LeaderboardEntry[] {
  const playerMap = new Map<string, PlayerStat[]>();

  for (const match of group.matches) {
    for (const p of match.players) {
      const arr = playerMap.get(p.nickname) || [];
      arr.push(p);
      playerMap.set(p.nickname, arr);
    }
  }

  return Array.from(playerMap.entries()).map(([nickname, stats]) => {
    const wins = stats.filter((s) => s.win).length;
    const losses = stats.length - wins;
    const totalKills = stats.reduce((s, p) => s + p.kills, 0);
    const totalDeaths = stats.reduce((s, p) => s + p.deaths, 0);
    const totalAssists = stats.reduce((s, p) => s + p.assists, 0);
    const avgKda = totalDeaths === 0 ? (totalKills + totalAssists) * 1.2 : (totalKills + totalAssists) / totalDeaths;
    const avgDamage = stats.reduce((s, p) => s + (p.damageDealt || 0), 0) / stats.length;
    const avgVision = stats.reduce((s, p) => s + (p.visionScore || 0), 0) / stats.length;
    const mvpCount = stats.filter((s) => s.isMvp).length;
    const aceCount = stats.filter((s) => s.isAce).length;
    const winRate = (wins / stats.length) * 100;

    // Score formula
    const totalScore =
      avgKda * 15 + winRate * 0.8 + Math.log(stats.length + 1) * 8 + mvpCount * 5;

    return {
      nickname,
      gamesPlayed: stats.length,
      wins,
      losses,
      winRate,
      avgKda,
      avgDamage,
      avgVision,
      mvpCount,
      aceCount,
      totalScore,
    };
  });
}

interface Award {
  title: string;
  emoji: string;
  player: string;
  value: string;
}

function computeAwards(group: Group, leaderboard: LeaderboardEntry[]): Award[] {
  const awards: Award[] = [];
  const allStats = group.matches.flatMap((m) => m.players);

  if (leaderboard.length === 0) return awards;

  // Most MVP
  const mostMvp = [...leaderboard].sort((a, b) => b.mvpCount - a.mvpCount)[0];
  if (mostMvp.mvpCount > 0) {
    awards.push({
      title: "MVP 헌터",
      emoji: "🏆",
      player: mostMvp.nickname,
      value: `${mostMvp.mvpCount}회`,
    });
  }

  // Highest KDA
  const bestKda = [...leaderboard].filter((e) => e.gamesPlayed >= 2).sort((a, b) => b.avgKda - a.avgKda)[0];
  if (bestKda) {
    awards.push({
      title: "KDA 장인",
      emoji: "⚔️",
      player: bestKda.nickname,
      value: `${bestKda.avgKda.toFixed(2)} KDA`,
    });
  }

  // Highest average damage
  const mostDamage = [...leaderboard].filter((e) => e.gamesPlayed >= 2).sort((a, b) => b.avgDamage - a.avgDamage)[0];
  if (mostDamage) {
    awards.push({
      title: "딜러 장인",
      emoji: "🔥",
      player: mostDamage.nickname,
      value: `평균 ${Math.round(mostDamage.avgDamage).toLocaleString()}`,
    });
  }

  // Best vision
  const bestVision = [...leaderboard].filter((e) => e.gamesPlayed >= 2).sort((a, b) => b.avgVision - a.avgVision)[0];
  if (bestVision) {
    awards.push({
      title: "시야 장인",
      emoji: "👁️",
      player: bestVision.nickname,
      value: `평균 ${bestVision.avgVision.toFixed(1)}`,
    });
  }

  // Public enemy - most deaths total
  const deathCounts = new Map<string, number>();
  for (const s of allStats) {
    deathCounts.set(s.nickname, (deathCounts.get(s.nickname) || 0) + s.deaths);
  }
  const mostDeaths = [...deathCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (mostDeaths && mostDeaths[1] > 0) {
    awards.push({
      title: "공공의 적",
      emoji: "💀",
      player: mostDeaths[0],
      value: `${mostDeaths[1]} 데스`,
    });
  }

  // 농사왕 - highest avg CS
  const avgCsMap = new Map<string, { total: number; count: number }>();
  for (const s of allStats) {
    const cur = avgCsMap.get(s.nickname) || { total: 0, count: 0 };
    cur.total += s.cs;
    cur.count++;
    avgCsMap.set(s.nickname, cur);
  }
  const farmKing = [...avgCsMap.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([name, v]) => ({ name, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg)[0];
  if (farmKing) {
    awards.push({
      title: "농사왕",
      emoji: "🌾",
      player: farmKing.name,
      value: `평균 ${Math.round(farmKing.avg)} CS`,
    });
  }

  // Best win rate (min 3 games)
  const bestWr = [...leaderboard].filter((e) => e.gamesPlayed >= 3).sort((a, b) => b.winRate - a.winRate)[0];
  if (bestWr) {
    awards.push({
      title: "승리 요정",
      emoji: "✨",
      player: bestWr.nickname,
      value: `${bestWr.winRate.toFixed(0)}% 승률`,
    });
  }

  // Tank king - highest avg damage taken
  const avgTakenMap = new Map<string, { total: number; count: number }>();
  for (const s of allStats) {
    const cur = avgTakenMap.get(s.nickname) || { total: 0, count: 0 };
    cur.total += s.damageTaken || 0;
    cur.count++;
    avgTakenMap.set(s.nickname, cur);
  }
  const tankKing = [...avgTakenMap.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([name, v]) => ({ name, avg: v.total / v.count }))
    .sort((a, b) => b.avg - a.avg)[0];
  if (tankKing && tankKing.avg > 0) {
    awards.push({
      title: "탱커 장인",
      emoji: "🛡️",
      player: tankKing.name,
      value: `평균 ${Math.round(tankKing.avg).toLocaleString()}`,
    });
  }

  return awards;
}

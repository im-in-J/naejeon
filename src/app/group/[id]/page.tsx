"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getGroup, deleteMatch } from "@/lib/store";
import { buildPlayerStats, buildChampionStats, computeAwards } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { PlayerStatsTab } from "@/components/group/player-stats-tab";
import { ChampionStatsTab } from "@/components/group/champion-stats-tab";
import { MatchHistoryTab } from "@/components/group/match-history-tab";
import { BalanceTab } from "@/components/group/balance-tab";
import { PlayerInfoTab } from "@/components/group/player-info-tab";
import { TeamSideTab } from "@/components/group/team-side-tab";
import {
  Upload,
  Copy,
  Check,
  Users,
  Swords,
  Gamepad2,
  Scale,
  UserCog,
  GitCompareArrows,
} from "lucide-react";
import type { Group } from "@/lib/types";

type Tab = "players" | "champions" | "sides" | "matches" | "info" | "balance";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "players", label: "선수별 성적", icon: <Users size={16} /> },
  { key: "champions", label: "챔피언 승률", icon: <Swords size={16} /> },
  { key: "sides", label: "진영별 통계", icon: <GitCompareArrows size={16} /> },
  { key: "matches", label: "매치 기록", icon: <Gamepad2 size={16} /> },
  { key: "info", label: "선수 정보", icon: <UserCog size={16} /> },
  { key: "balance", label: "팀 밸런스", icon: <Scale size={16} /> },
];

export default function GroupPage() {
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [tab, setTab] = useState<Tab>("players");
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState(0); // force re-compute on update

  const groupId = params.id as string;

  useEffect(() => {
    setGroup(getGroup(groupId));
  }, [groupId, version]);

  const playerStats = useMemo(() => (group ? buildPlayerStats(group) : []), [group]);
  const championStats = useMemo(() => (group ? buildChampionStats(group) : []), [group]);
  const awards = useMemo(() => (group ? computeAwards(group, playerStats) : []), [group, playerStats]);

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">그룹을 찾을 수 없습니다</p>
      </div>
    );
  }

  const copyInviteLink = () => {
    const url = `${window.location.origin}/invite/${group.inviteCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteMatch = (matchId: string) => {
    deleteMatch(groupId, matchId);
    setVersion((v) => v + 1);
  };

  const uniquePlayers = new Set(group.matches.flatMap((m) => m.players.map((p) => p.nickname))).size;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header — compact */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink tracking-tight">{group.name}</h1>
          <span className="text-xs text-ink-tertiary">{uniquePlayers}명 · {group.matches.length}경기</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={copyInviteLink}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "복사됨" : "초대"}
          </Button>
          <Button size="sm" onClick={() => router.push(`/group/${groupId}/upload`)}>
            <Upload size={13} />
            등록
          </Button>
        </div>
      </div>

      {/* Tabs — lol.ps style: compact pill row */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer whitespace-nowrap transition-fast ${
              tab === t.key
                ? "bg-primary/15 text-primary"
                : "text-ink-subtle hover:text-ink hover:bg-surface-1"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "players" && <PlayerStatsTab playerStats={playerStats} awards={awards} />}
      {tab === "champions" && <ChampionStatsTab championStats={championStats} />}
      {tab === "sides" && <TeamSideTab group={group} />}
      {tab === "matches" && (
        <MatchHistoryTab
          matches={group.matches}
          groupId={groupId}
          onDelete={handleDeleteMatch}
        />
      )}
      {tab === "info" && (
        <PlayerInfoTab
          group={group}
          playerStats={playerStats}
          onUpdate={() => setVersion((v) => v + 1)}
        />
      )}
      {tab === "balance" && <BalanceTab playerStats={playerStats} group={group} />}
    </div>
  );
}

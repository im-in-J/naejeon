"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { getGroup, deleteMatch as deleteMatchApi } from "@/lib/store";
import { buildPlayerStats, buildChampionStats, computeAwards } from "@/lib/stats";
import { Button } from "@/components/ui/button";
import { PlayerStatsTab } from "@/components/group/player-stats-tab";
import { ChampionStatsTab } from "@/components/group/champion-stats-tab";
import { MatchHistoryTab } from "@/components/group/match-history-tab";
import { BalanceTab } from "@/components/group/balance-tab";
import { PlayerInfoTab } from "@/components/group/player-info-tab";
import { TeamSideTab } from "@/components/group/team-side-tab";
import { Modal } from "@/components/ui/modal";
import {
  Users,
  Swords,
  Gamepad2,
  Scale,
  UserCog,
  GitCompareArrows,
  Download,
  Plus,
  HelpCircle,
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

export default function MainGroupPage() {
  const [group, setGroup] = useState<Group | null>(null);
  const [tab, setTab] = useState<Tab>("players");
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);

  const loadData = useCallback(async () => {
    const g = await getGroup();
    setGroup(g);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const playerStats = useMemo(() => (group ? buildPlayerStats(group) : []), [group]);
  const championStats = useMemo(() => (group ? buildChampionStats(group) : []), [group]);
  const awards = useMemo(() => (group ? computeAwards(group, playerStats) : []), [group, playerStats]);

  const handleDeleteMatch = async (matchId: string) => {
    await deleteMatchApi(matchId);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-ink-subtle text-sm">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-ink-subtle">데이터를 불러올 수 없습니다</p>
      </div>
    );
  }

  const uniquePlayers = new Set(group.matches.flatMap((m) => m.players.map((p) => p.nickname))).size;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink tracking-tight">{group.name}</h1>
          <span className="text-xs text-ink-tertiary">{uniquePlayers}명 · {group.matches.length}경기</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowManual(true)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-ink-tertiary hover:text-ink hover:bg-surface-1 transition-fast cursor-pointer"
          >
            <HelpCircle size={13} />
          </button>
          <a href="/api/collector" download className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium text-ink-subtle hover:text-ink hover:bg-surface-1 transition-fast">
            <Download size={13} />
            수집기
          </a>
          <Button size="sm" onClick={() => window.location.href = "/group/main/new"}>
            <Plus size={13} />
            수동 등록
          </Button>
        </div>
      </div>

      {/* Tabs */}
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
          groupId="main"
          onDelete={handleDeleteMatch}
        />
      )}
      {tab === "info" && (
        <PlayerInfoTab
          group={group}
          playerStats={playerStats}
          onUpdate={loadData}
        />
      )}
      {tab === "balance" && <BalanceTab playerStats={playerStats} group={group} />}

      {/* 수집기 메뉴얼 */}
      <Modal open={showManual} onClose={() => setShowManual(false)} title="수집기 사용법" className="max-w-2xl">
        <div className="space-y-5 text-sm text-ink-muted">
          <div>
            <h3 className="text-ink font-semibold mb-2">설치</h3>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Python 3.8 이상 설치 — <a href="https://python.org/downloads" target="_blank" className="text-primary hover:text-primary-hover underline">python.org/downloads</a></li>
              <li>상단 <span className="text-ink font-medium">수집기</span> 버튼 클릭 → <code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">naejeon-collector.py</code> 다운로드</li>
              <li>서버 URL이 자동으로 설정되어 있어 바로 사용 가능</li>
            </ol>
          </div>

          <div>
            <h3 className="text-ink font-semibold mb-2">실시간 자동 수집</h3>
            <div className="bg-surface-2 rounded-lg px-4 py-3 font-mono text-xs text-ink">
              python naejeon-collector.py
            </div>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>롤 클라이언트가 켜져있으면 자동 감지</li>
              <li>게임 끝나면 자동으로 데이터 추출 & 업로드</li>
              <li>딜량, 피해량, 시야점수 등 모든 상세 스탯 포함</li>
              <li>내전 참여자 중 1명만 실행하면 됨</li>
              <li>롤 켜놓고 백그라운드에서 계속 돌려두세요</li>
            </ul>
          </div>

          <div>
            <h3 className="text-ink font-semibold mb-2">과거 경기 가져오기</h3>
            <div className="bg-surface-2 rounded-lg px-4 py-3 font-mono text-xs text-ink">
              python naejeon-collector.py --history
            </div>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>롤 클라이언트에서 최근 200경기 중 커스텀 게임 조회</li>
              <li>날짜, 팀 구성, 승패 미리보기 표시</li>
              <li>원하는 경기 번호 선택해서 업로드</li>
              <li className="text-ink-tertiary">
                입력 예시: <code className="bg-surface-2 px-1 rounded">1,3,5</code> (개별)
                <code className="bg-surface-2 px-1 rounded ml-1">1-5</code> (범위)
                <code className="bg-surface-2 px-1 rounded ml-1">all</code> (전체)
              </li>
            </ul>
          </div>

          <div className="border-t border-hairline pt-4">
            <h3 className="text-ink font-semibold mb-2">FAQ</h3>
            <div className="space-y-2.5">
              <div>
                <p className="text-ink text-xs font-medium">Q. 롤 경로가 기본이 아닌 경우?</p>
                <div className="bg-surface-2 rounded-lg px-4 py-2 font-mono text-xs text-ink mt-1">
                  set LOL_PATH=D:\Games\League of Legends<br/>
                  python naejeon-collector.py
                </div>
              </div>
              <div>
                <p className="text-ink text-xs font-medium">Q. 업로드 실패 시?</p>
                <p className="text-xs">로컬에 <code className="bg-surface-2 px-1 rounded">match_backup_*.json</code> 파일로 백업됩니다. 나중에 수동 등록으로 입력하세요.</p>
              </div>
              <div>
                <p className="text-ink text-xs font-medium">Q. 여러 명이 동시에 수집기를 돌리면?</p>
                <p className="text-xs">같은 경기가 중복 등록될 수 있으니, 1명만 돌리는 걸 권장합니다.</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

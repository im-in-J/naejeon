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

const CACHE_KEY = "naejeon-group-cache-v1";

export default function MainGroupPage() {
  const [group, setGroup] = useState<Group | null>(null);
  const [tab, setTab] = useState<Tab>("players");
  const [loading, setLoading] = useState(true);
  const [showManual, setShowManual] = useState(false);

  const loadData = useCallback(async () => {
    const g = await getGroup();
    setGroup(g);
    setLoading(false);
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(g));
    } catch {
      // 저장 실패(용량 초과 등)해도 동작에는 지장 없음
    }
  }, []);

  useEffect(() => {
    // 같은 세션 내 재방문이면 캐시로 즉시 렌더하고, 백그라운드에서 최신 데이터로 갱신
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        setGroup(JSON.parse(cached) as Group);
        setLoading(false);
      }
    } catch {
      // 캐시 파손 시 무시하고 네트워크 로드
    }
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
            <h3 className="text-ink font-semibold mb-2">1단계: 준비</h3>
            <ol className="list-decimal list-inside space-y-1.5">
              <li>Python 설치 — <a href="https://python.org/downloads" target="_blank" className="text-primary hover:text-primary-hover underline">python.org/downloads</a> (설치 시 <span className="text-ink font-medium">&quot;Add to PATH&quot; 반드시 체크</span>)</li>
              <li>상단 <span className="text-ink font-medium">수집기</span> 버튼 클릭 → ZIP 파일 다운로드</li>
              <li>압축 풀기 → 2개 파일 확인: <code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">내전수집기.bat</code>, <code className="text-xs bg-surface-2 px-1.5 py-0.5 rounded">naejeon-collector.py</code></li>
            </ol>
          </div>

          <div>
            <h3 className="text-ink font-semibold mb-2">2단계: 실행</h3>
            <p className="mb-2"><span className="text-ink font-medium">내전수집기.bat</span> 더블클릭하면 메뉴가 나옵니다:</p>
            <div className="bg-surface-2 rounded-lg px-4 py-3 text-xs text-ink font-mono space-y-0.5">
              <p>==========================================</p>
              <p>&nbsp; 컴학내전 데이터 수집기</p>
              <p>==========================================</p>
              <p>&nbsp;</p>
              <p>&nbsp; 1. 실시간 수집 (게임 끝나면 자동 업로드)</p>
              <p>&nbsp; 2. 과거 경기 가져오기</p>
              <p>&nbsp; 3. 종료</p>
              <p>&nbsp;</p>
              <p>&nbsp; 선택 (1/2/3): _</p>
            </div>
          </div>

          <div>
            <h3 className="text-ink font-semibold mb-2">메뉴 설명</h3>
            <div className="space-y-3">
              <div className="bg-surface-2/50 rounded-lg px-4 py-3">
                <p className="text-ink font-medium text-xs mb-1">1번: 실시간 수집</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>롤 클라이언트 자동 감지</li>
                  <li>게임 끝나면 자동 업로드 (딜량, 시야 등 전부)</li>
                  <li>내전 할 때 켜두면 됨</li>
                </ul>
              </div>
              <div className="bg-surface-2/50 rounded-lg px-4 py-3">
                <p className="text-ink font-medium text-xs mb-1">2번: 과거 경기 가져오기</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>최근 200경기 중 커스텀 게임 목록 표시</li>
                  <li>원하는 경기 번호 입력 → 업로드</li>
                  <li>예: <code className="bg-surface-2 px-1 rounded">1,3,5</code> 또는 <code className="bg-surface-2 px-1 rounded">1-5</code> 또는 <code className="bg-surface-2 px-1 rounded">all</code></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-hairline pt-4">
            <h3 className="text-ink font-semibold mb-2">주의사항</h3>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>롤 클라이언트가 켜져있어야 합니다</li>
              <li>같은 게임은 서버에서 자동으로 중복 방지됩니다 (여러 명이 실행해도 안전)</li>
              <li>업로드 실패 시 로컬에 백업 파일이 저장됩니다</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
}

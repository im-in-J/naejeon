"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { updateMemberProfile, mergeAliases } from "@/lib/store";
import { Save, Edit3, User, X, Link } from "lucide-react";
import type { Group, Member, Lane } from "@/lib/types";
import type { PlayerStats } from "@/lib/stats";

const LANES: { key: Lane; label: string; emoji: string }[] = [
  { key: "top", label: "탑", emoji: "🛡️" },
  { key: "jungle", label: "정글", emoji: "🌿" },
  { key: "mid", label: "미드", emoji: "🔥" },
  { key: "adc", label: "원딜", emoji: "🏹" },
  { key: "support", label: "서포터", emoji: "💚" },
];

const LANE_LABEL: Record<string, string> = {
  top: "탑", jungle: "정글", mid: "미드", adc: "원딜", support: "서포터",
};

const TIERS = [
  "실버 4", "실버 3", "실버 2", "실버 1",
  "골드 4", "골드 3", "골드 2", "골드 1",
  "플래티넘 4", "플래티넘 3", "플래티넘 2", "플래티넘 1",
  "에메랄드 4", "에메랄드 3", "에메랄드 2", "에메랄드 1",
  "다이아 4", "다이아 3", "다이아 2", "다이아 1",
  "마스터",
];

const TIER_COLORS: Record<string, string> = {
  "실버": "text-gray-300",
  "골드": "text-yellow-400",
  "플래티넘": "text-teal-300",
  "에메랄드": "text-emerald-400",
  "다이아": "text-blue-400",
  "마스터": "text-purple-400",
};

function getTierColor(tier?: string): string {
  if (!tier) return "text-text-muted";
  const base = tier.split(" ")[0];
  return TIER_COLORS[base] || "text-text-muted";
}

export function PlayerInfoTab({
  group,
  playerStats,
  onUpdate,
}: {
  group: Group;
  playerStats: PlayerStats[];
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editTier, setEditTier] = useState("");
  const [editLanes, setEditLanes] = useState<Lane[]>([]);
  const [editRealName, setEditRealName] = useState("");
  const [editAliasInput, setEditAliasInput] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeAlias, setMergeAlias] = useState("");

  const openEdit = (member: Member) => {
    setEditing(member.nickname);
    setEditTier(member.tier || "");
    setEditLanes(member.preferredLanes || []);
    setEditRealName(member.realName || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    await updateMemberProfile(editing, {
      tier: editTier,
      preferredLanes: editLanes,
      realName: editRealName,
    });
    setEditing(null);
    onUpdate();
  };

  const toggleLane = (lane: Lane) => {
    setEditLanes((prev) => {
      if (prev.includes(lane)) {
        return prev.filter((l) => l !== lane);
      }
      return [...prev, lane];
    });
  };

  const handleMerge = async () => {
    if (!mergeTarget || !mergeAlias) return;
    await mergeAliases(mergeTarget, mergeAlias);
    setShowMerge(false);
    setMergeTarget("");
    setMergeAlias("");
    onUpdate();
  };

  const players = playerStats.map((ps) => {
    const member = group.members.find((m) => m.nickname === ps.nickname);
    return {
      ...ps,
      tier: member?.tier,
      preferredLanes: member?.preferredLanes,
      realName: member?.realName,
      aliases: member?.aliases,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          선수별 정보를 관리하세요. 티어와 선호 라인은 팀 밸런스에 반영됩니다.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setShowMerge(true)}>
          <Link size={14} />
          아이디 통합
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {players.map((player) => (
          <Card key={player.nickname} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-bg-secondary flex items-center justify-center">
                  <User size={16} className="text-text-muted" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-text-primary text-sm">{player.nickname}</span>
                    {player.realName && (
                      <span className="text-xs text-text-muted">({player.realName})</span>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">
                    {player.gamesPlayed}판 · 승률 {player.winRate.toFixed(0)}%
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  const member = group.members.find((m) => m.nickname === player.nickname);
                  if (member) openEdit(member);
                }}
                className="p-1.5 rounded-lg text-text-muted hover:text-accent hover:bg-accent/10 transition-fast cursor-pointer"
              >
                <Edit3 size={14} />
              </button>
            </div>

            {/* Aliases */}
            {player.aliases && player.aliases.length > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-text-muted w-12">부캐</span>
                <div className="flex flex-wrap gap-1">
                  {player.aliases.map((alias) => (
                    <span key={alias} className="text-xs px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary">
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tier */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-text-muted w-12">티어</span>
              {player.tier ? (
                <span className={`text-sm font-bold ${getTierColor(player.tier)}`}>
                  {player.tier}
                </span>
              ) : (
                <span className="text-xs text-text-muted">미설정</span>
              )}
            </div>

            {/* Preferred Lanes (ordered) */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-text-muted w-12">포지션</span>
              {player.preferredLanes && player.preferredLanes.length > 0 ? (
                <div className="flex gap-1">
                  {player.preferredLanes.map((lane, i) => {
                    const l = LANES.find((la) => la.key === lane);
                    return (
                      <span
                        key={lane}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium"
                      >
                        <span className="text-[10px] text-accent/60">{i + 1}</span>
                        {l?.emoji} {l?.label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-xs text-text-muted">미설정</span>
              )}
            </div>

            {/* Lane Stats */}
            {player.laneStats.length > 0 && (
              <div className="border-t border-border pt-2">
                <div className="text-xs text-text-muted mb-1.5">라인별 전적</div>
                <div className="space-y-1">
                  {player.laneStats.map((ls) => (
                    <div key={ls.lane} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span>{LANES.find((l) => l.key === ls.lane)?.emoji}</span>
                        <span className="text-text-primary">{LANE_LABEL[ls.lane]}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted">{ls.games}판</span>
                        <span className={ls.winRate >= 50 ? "text-win font-medium" : "text-lose"}>
                          {ls.winRate.toFixed(0)}%
                        </span>
                        <span className="text-text-muted">KDA {ls.avgKda.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Edit Modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`${editing} 정보 수정`}
      >
        <div className="space-y-5">
          {/* Real Name */}
          <Input
            id="real-name"
            label="실명"
            placeholder="실명을 입력하세요"
            value={editRealName}
            onChange={(e) => setEditRealName(e.target.value)}
          />

          {/* Tier */}
          <div>
            <label className="text-sm text-text-secondary font-medium block mb-2">솔랭 티어</label>
            <select
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              value={editTier}
              onChange={(e) => setEditTier(e.target.value)}
            >
              <option value="">미설정</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Preferred Lanes (ordered) */}
          <div>
            <label className="text-sm text-text-secondary font-medium block mb-1">선호 포지션</label>
            <p className="text-xs text-text-muted mb-2">클릭한 순서대로 1순위, 2순위... 가 됩니다</p>

            {/* Current order */}
            {editLanes.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                {editLanes.map((lane, i) => {
                  const l = LANES.find((la) => la.key === lane);
                  return (
                    <div
                      key={lane}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/15 text-accent text-sm font-medium"
                    >
                      <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      {l?.emoji} {l?.label}
                      <button
                        type="button"
                        onClick={() => setEditLanes((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-0.5 text-accent/50 hover:text-accent cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {LANES.map((lane) => {
                const idx = editLanes.indexOf(lane.key);
                const active = idx !== -1;
                return (
                  <button
                    key={lane.key}
                    type="button"
                    onClick={() => toggleLane(lane.key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-fast cursor-pointer ${
                      active
                        ? "bg-accent/20 text-accent border border-accent/30"
                        : "bg-bg-card text-text-muted border border-border hover:border-border-hover"
                    }`}
                  >
                    {active && (
                      <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                    )}
                    <span>{lane.emoji}</span>
                    {lane.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>취소</Button>
            <Button onClick={saveEdit}>
              <Save size={16} />
              저장
            </Button>
          </div>
        </div>
      </Modal>

      {/* Merge Alias Modal */}
      <Modal
        open={showMerge}
        onClose={() => setShowMerge(false)}
        title="아이디 통합 (부캐 합치기)"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            부캐 아이디를 본캐에 통합합니다. 부캐의 모든 매치 기록이 본캐로 합산됩니다.
          </p>

          <div>
            <label className="text-sm text-text-secondary font-medium block mb-2">본캐 (메인 아이디)</label>
            <select
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              value={mergeTarget}
              onChange={(e) => setMergeTarget(e.target.value)}
            >
              <option value="">선택하세요</option>
              {group.members.map((m) => (
                <option key={m.nickname} value={m.nickname}>
                  {m.nickname}{m.realName ? ` (${m.realName})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-text-secondary font-medium block mb-2">부캐 (통합할 아이디)</label>
            <select
              className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
              value={mergeAlias}
              onChange={(e) => setMergeAlias(e.target.value)}
            >
              <option value="">선택하세요</option>
              {group.members
                .filter((m) => m.nickname !== mergeTarget)
                .map((m) => (
                  <option key={m.nickname} value={m.nickname}>
                    {m.nickname}{m.realName ? ` (${m.realName})` : ""}
                  </option>
                ))}
            </select>
          </div>

          {mergeTarget && mergeAlias && (
            <div className="bg-bg-card border border-border rounded-xl p-3 text-sm">
              <span className="text-text-primary font-medium">{mergeAlias}</span>
              <span className="text-text-muted"> 의 모든 기록이 </span>
              <span className="text-accent font-medium">{mergeTarget}</span>
              <span className="text-text-muted"> 으로 합산됩니다.</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowMerge(false)}>취소</Button>
            <Button onClick={handleMerge} disabled={!mergeTarget || !mergeAlias}>
              <Link size={16} />
              통합하기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

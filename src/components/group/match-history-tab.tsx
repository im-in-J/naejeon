"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Trash2, Gamepad2, Clock, Trophy, Download } from "lucide-react";
import { ChampionIcon } from "@/components/ui/champion-icon";
import type { Match } from "@/lib/types";

const LANE_EMOJI: Record<string, string> = {
  top: "🛡️", jungle: "🌿", mid: "🔥", adc: "🏹", support: "💚",
};

export function MatchHistoryTab({
  matches,
  groupId,
  onDelete,
}: {
  matches: Match[];
  groupId: string;
  onDelete: (matchId: string) => void;
}) {
  const router = useRouter();
  const reversed = [...matches].reverse();

  if (matches.length === 0) {
    return (
      <Card className="text-center py-16">
        <Gamepad2 size={48} className="mx-auto text-ink-tertiary mb-4 opacity-50" />
        <p className="text-ink-muted text-lg mb-2">아직 기록된 경기가 없습니다</p>
        <p className="text-sm text-ink-subtle mb-6">수집기를 설치하면 게임 종료 시 자동으로 기록됩니다</p>
        <a href="/api/collector" download>
          <Button>
            <Download size={16} />
            수집기 다운로드
          </Button>
        </a>
      </Card>
    );
  }

  // Group matches by date
  const grouped = new Map<string, Match[]>();
  for (const match of reversed) {
    const dateKey = new Date(match.createdAt).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const arr = grouped.get(dateKey) || [];
    arr.push(match);
    grouped.set(dateKey, arr);
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([date, dateMatches]) => (
        <div key={date}>
          {/* Date Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="text-sm font-semibold text-ink-muted">{date}</div>
            <div className="flex-1 h-px bg-hairline" />
            <div className="text-xs text-ink-tertiary">{dateMatches.length}경기</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {dateMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                groupId={groupId}
                onDelete={onDelete}
                onClick={() => router.push(`/group/${groupId}/match/${match.id}`)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchCard({
  match,
  groupId,
  onDelete,
  onClick,
}: {
  match: Match;
  groupId: string;
  onDelete: (matchId: string) => void;
  onClick: () => void;
}) {
  const blue = match.players.filter((p) => p.team === "blue");
  const red = match.players.filter((p) => p.team === "red");
  const blueWin = blue.length > 0 && blue[0].win;
  const mvp = match.players.find((p) => p.isMvp);
  const ace = match.players.find((p) => p.isAce);
  const blueKills = blue.reduce((s, p) => s + p.kills, 0);
  const redKills = red.reduce((s, p) => s + p.kills, 0);
  const time = new Date(match.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onClick={onClick}
      className="group relative rounded-lg border border-hairline bg-surface-1 hover:bg-surface-2 hover:border-hairline-strong cursor-pointer transition-fast overflow-hidden"
    >
      {/* Win indicator bar */}
      <div className={`absolute top-0 left-0 w-1 h-full ${blueWin ? "bg-blue-500" : "bg-red-500"}`} />

      <div className="pl-4 pr-3 py-4">
        {/* Top row: time, duration, MVP/ACE */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 text-xs text-ink-subtle">
              <Clock size={12} />
              {time}
            </div>
            {match.gameDuration && (
              <span className="text-xs text-ink-subtle px-2 py-0.5 rounded bg-surface-2">
                {match.gameDuration}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {mvp && (
              <Badge variant="mvp">
                <Trophy size={10} className="mr-0.5" /> {mvp.nickname}
              </Badge>
            )}
            {ace && (
              <Badge variant="ace">
                ACE {ace.nickname}
              </Badge>
            )}
          </div>
        </div>

        {/* Score row */}
        <div className="flex items-center gap-3">
          {/* Blue side */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${
                blueWin ? "bg-win/10 text-win" : "bg-lose/10 text-lose"
              }`}>
                {blueWin ? "승리" : "패배"}
              </div>
              <span className={`text-2xl font-bold tabular-nums ${blueWin ? "text-blue-400" : "text-ink-tertiary"}`}>
                {blueKills}
              </span>
            </div>
            <div className="space-y-1.5">
              {blue.map((p) => (
                <PlayerRow key={p.id} player={p} align="left" isMvp={p.isMvp} isAce={p.isAce} />
              ))}
            </div>
          </div>

          {/* VS divider */}
          <div className="flex flex-col items-center gap-1 px-1 shrink-0">
            <div className="w-px h-6 bg-hairline" />
            <span className="text-[10px] font-semibold text-ink-tertiary">VS</span>
            <div className="w-px h-6 bg-hairline" />
          </div>

          {/* Red side */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 justify-end mb-2.5">
              <span className={`text-2xl font-bold tabular-nums ${!blueWin ? "text-red-400" : "text-ink-tertiary"}`}>
                {redKills}
              </span>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold ${
                !blueWin ? "bg-win/10 text-win" : "bg-lose/10 text-lose"
              }`}>
                {!blueWin ? "승리" : "패배"}
              </div>
            </div>
            <div className="space-y-1.5">
              {red.map((p) => (
                <PlayerRow key={p.id} player={p} align="right" isMvp={p.isMvp} isAce={p.isAce} />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0 ml-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("이 경기를 삭제하시겠습니까?")) onDelete(match.id);
              }}
              className="p-1.5 rounded text-ink-tertiary hover:text-lose hover:bg-lose/10 opacity-0 group-hover:opacity-100 transition-fast cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
            <ChevronRight size={16} className="text-ink-tertiary/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  align,
  isMvp,
  isAce,
}: {
  player: { nickname: string; champion: string; kills: number; deaths: number; assists: number; lane?: string };
  align: "left" | "right";
  isMvp: boolean;
  isAce: boolean;
}) {
  const lane = player.lane ? LANE_EMOJI[player.lane] : "";
  const kda = `${player.kills}/${player.deaths}/${player.assists}`;

  const kdaColor = player.deaths === 0
    ? "text-win"
    : (player.kills + player.assists) / player.deaths >= 3
      ? "text-ink"
      : (player.kills + player.assists) / player.deaths < 1.5
        ? "text-lose/80"
        : "text-ink-muted";

  if (align === "right") {
    return (
      <div className="flex items-center gap-1.5 justify-end text-[13px] py-0.5">
        <span className={`font-mono text-xs tabular-nums ${kdaColor}`}>
          <span className="text-ink-muted">{player.kills}</span>
          <span className="text-ink-tertiary">/</span>
          <span className="text-lose/70">{player.deaths}</span>
          <span className="text-ink-tertiary">/</span>
          <span className="text-ink-muted">{player.assists}</span>
        </span>
        <span className={`font-semibold truncate max-w-[90px] ${isMvp ? "text-mvp" : isAce ? "text-ace" : "text-ink"}`}>
          {player.nickname}
        </span>
        <ChampionIcon name={player.champion} size={18} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[13px] py-0.5">
      <ChampionIcon name={player.champion} size={18} />
      <span className={`font-semibold truncate max-w-[90px] ${isMvp ? "text-mvp" : isAce ? "text-ace" : "text-ink"}`}>
        {player.nickname}
      </span>
      <span className={`font-mono text-xs tabular-nums ${kdaColor}`}>
        <span className="text-ink-muted">{player.kills}</span>
        <span className="text-ink-tertiary">/</span>
        <span className="text-lose/70">{player.deaths}</span>
        <span className="text-ink-tertiary">/</span>
        <span className="text-ink-muted">{player.assists}</span>
      </span>
    </div>
  );
}

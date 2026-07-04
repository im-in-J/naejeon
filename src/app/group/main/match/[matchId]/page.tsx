"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getMatch, getAllMembers } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Trophy, Flame, Shield, Eye, Clock, Swords } from "lucide-react";
import type { Match, PlayerStat, Member } from "@/lib/types";

const LANE_EMOJI: Record<string, string> = {
  top: "🛡️", jungle: "🌿", mid: "🔥", adc: "🏹", support: "💚",
};
const LANE_LABEL: Record<string, string> = {
  top: "탑", jungle: "정글", mid: "미드", adc: "원딜", support: "서폿",
};

export default function MatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const matchId = params.matchId as string;

  useEffect(() => {
    async function load() {
      const [m, mems] = await Promise.all([getMatch(matchId), getAllMembers()]);
      setMatch(m);
      setMembers(mems);
      setLoading(false);
    }
    load();
  }, [matchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-ink-subtle">경기를 찾을 수 없습니다</p>
      </div>
    );
  }

  const blue = match.players.filter((p) => p.team === "blue");
  const red = match.players.filter((p) => p.team === "red");
  const blueWin = blue.length > 0 && blue[0].win;

  const blueKills = blue.reduce((s, p) => s + p.kills, 0);
  const redKills = red.reduce((s, p) => s + p.kills, 0);
  const blueGold = blue.reduce((s, p) => s + p.gold, 0);
  const redGold = red.reduce((s, p) => s + p.gold, 0);

  const maxDamage = Math.max(...match.players.map((p) => p.damageDealt || 1));
  const maxTaken = Math.max(...match.players.map((p) => p.damageTaken || 1));
  const maxGold = Math.max(...match.players.map((p) => p.gold || 1));

  const mvp = match.players.find((p) => p.isMvp);
  const ace = match.players.find((p) => p.isAce);

  const getMemberRealName = (nickname: string) =>
    members.find((m) => m.nickname === nickname)?.realName;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => router.push("/group/main")}
        className="flex items-center gap-1 text-sm text-ink-subtle hover:text-ink mb-6 transition-fast cursor-pointer"
      >
        <ChevronLeft size={16} />
        돌아가기
      </button>

      {/* Match Header Card */}
      <Card className="mb-6 p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/5 via-transparent to-red-500/5 p-6">
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="flex items-center gap-1.5 text-xs text-ink-subtle">
              <Clock size={12} />
              {new Date(match.createdAt).toLocaleDateString("ko-KR", {
                year: "numeric", month: "long", day: "numeric",
              })}
            </div>
            {match.gameDuration && (
              <span className="text-xs text-ink-subtle px-2 py-0.5 rounded-full bg-surface-2">
                {match.gameDuration}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <div className="text-center">
              <div className={`text-4xl sm:text-5xl font-bold tabular-nums ${blueWin ? "text-blue-400" : "text-ink-tertiary"}`}>
                {blueKills}
              </div>
              <div className="text-sm font-bold text-blue-400 mt-1">블루팀</div>
              <Badge variant={blueWin ? "win" : "lose"} className="mt-1.5">
                {blueWin ? "승리" : "패배"}
              </Badge>
              <div className="text-xs text-ink-subtle mt-1">
                <span className="text-gold">{blueGold.toLocaleString()}</span> G
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Swords size={24} className="text-ink-tertiary/30" />
              <span className="text-xs font-bold text-ink-tertiary/40">VS</span>
            </div>
            <div className="text-center">
              <div className={`text-4xl sm:text-5xl font-bold tabular-nums ${!blueWin ? "text-red-400" : "text-ink-tertiary"}`}>
                {redKills}
              </div>
              <div className="text-sm font-bold text-red-400 mt-1">레드팀</div>
              <Badge variant={!blueWin ? "win" : "lose"} className="mt-1.5">
                {!blueWin ? "승리" : "패배"}
              </Badge>
              <div className="text-xs text-ink-subtle mt-1">
                <span className="text-gold">{redGold.toLocaleString()}</span> G
              </div>
            </div>
          </div>

          {(mvp || ace) && (
            <div className="flex items-center justify-center gap-3 mt-5">
              {mvp && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-mvp/10 border border-mvp/20">
                  <Trophy size={14} className="text-mvp" />
                  <span className="text-xs font-bold text-mvp">MVP</span>
                  <span className="text-sm font-bold text-ink">{mvp.nickname}</span>
                  <span className="text-xs text-ink-subtle">{mvp.mvpScore.toFixed(1)}점</span>
                </div>
              )}
              {ace && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ace/10 border border-ace/20">
                  <span className="text-xs font-bold text-ace">ACE</span>
                  <span className="text-sm font-bold text-ink">{ace.nickname}</span>
                  <span className="text-xs text-ink-subtle">{ace.mvpScore.toFixed(1)}점</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      <TeamSection team="blue" players={blue} win={blueWin} maxDamage={maxDamage} maxTaken={maxTaken} maxGold={maxGold} getRealName={getMemberRealName} />
      <div className="my-4" />
      <TeamSection team="red" players={red} win={!blueWin} maxDamage={maxDamage} maxTaken={maxTaken} maxGold={maxGold} getRealName={getMemberRealName} />
    </div>
  );
}

function TeamSection({ team, players, win, maxDamage, maxTaken, maxGold, getRealName }: {
  team: "blue" | "red"; players: PlayerStat[]; win: boolean;
  maxDamage: number; maxTaken: number; maxGold: number;
  getRealName: (n: string) => string | undefined;
}) {
  const borderColor = team === "blue" ? "border-l-blue-500/40" : "border-l-red-500/40";
  const headerBg = team === "blue" ? "bg-blue-500/5" : "bg-red-500/5";
  const teamColor = team === "blue" ? "text-blue-400" : "text-red-400";

  return (
    <Card className={`border-l-4 ${borderColor} p-0 overflow-hidden`}>
      <div className={`${headerBg} px-4 py-2.5 flex items-center justify-between border-b border-hairline/50`}>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${teamColor}`}>{team === "blue" ? "블루팀" : "레드팀"}</span>
          <Badge variant={win ? "win" : "lose"}>{win ? "승리" : "패배"}</Badge>
        </div>
        <div className="text-xs text-ink-subtle">
          {players.reduce((s, p) => s + p.kills, 0)}/{players.reduce((s, p) => s + p.deaths, 0)}/{players.reduce((s, p) => s + p.assists, 0)}
        </div>
      </div>
      <div className="divide-y divide-hairline/30">
        {players.map((p) => {
          const kda = p.deaths === 0 ? "Perfect" : ((p.kills + p.assists) / p.deaths).toFixed(1);
          const kdaColor = kda === "Perfect" || parseFloat(kda) >= 4 ? "text-win" : parseFloat(kda) < 2 ? "text-lose" : "text-ink";
          const damagePercent = maxDamage > 0 ? (p.damageDealt / maxDamage) * 100 : 0;
          const takenPercent = maxTaken > 0 ? (p.damageTaken / maxTaken) * 100 : 0;
          const goldPercent = maxGold > 0 ? (p.gold / maxGold) * 100 : 0;
          const realName = getRealName(p.nickname);

          return (
            <div key={p.id} className="px-4 py-3 hover:bg-surface-1/30 transition-fast">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-sm font-bold text-ink-subtle shrink-0">
                    {p.champion ? p.champion.charAt(0) : "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink text-sm">{p.nickname}</span>
                      {realName && <span className="text-xs text-ink-tertiary">({realName})</span>}
                      {p.isMvp && <Badge variant="mvp">MVP</Badge>}
                      {p.isAce && <Badge variant="ace">ACE</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-ink-tertiary">
                      <span>{p.champion}</span>
                      {p.lane && <span>{LANE_EMOJI[p.lane]} {LANE_LABEL[p.lane]}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-sm font-bold text-ink tabular-nums">
                      {p.kills} / <span className="text-lose">{p.deaths}</span> / {p.assists}
                    </div>
                    <div className={`text-xs font-medium ${kdaColor}`}>{kda} KDA</div>
                  </div>
                  <div className="w-10 text-center">
                    <div className="text-sm font-bold text-primary">{p.mvpScore.toFixed(1)}</div>
                    <div className="text-[10px] text-ink-tertiary">점수</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 ml-[46px]">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ink-tertiary">CS / 골드</span>
                    <span className="text-ink tabular-nums">{p.cs}</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-500/60 to-yellow-400 rounded-full" style={{ width: `${goldPercent}%` }} />
                  </div>
                  <div className="text-[10px] text-gold mt-0.5 tabular-nums">{(p.gold || 0).toLocaleString()}G</div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ink-tertiary flex items-center gap-0.5"><Flame size={10} />딜량</span>
                    <span className="text-ink tabular-nums">{(p.damageDealt || 0).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" style={{ width: `${damagePercent}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-ink-tertiary flex items-center gap-0.5"><Shield size={10} />피해</span>
                    <span className="text-ink tabular-nums">{(p.damageTaken || 0).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${takenPercent}%` }} />
                  </div>
                </div>
              </div>
              {(p.visionScore > 0 || p.wardsPlaced > 0) && (
                <div className="flex items-center gap-4 ml-[46px] mt-1.5 text-xs text-ink-tertiary">
                  {p.visionScore > 0 && <span className="flex items-center gap-0.5"><Eye size={10} /> 시야 {p.visionScore}</span>}
                  {p.wardsPlaced > 0 && <span>와드 {p.wardsPlaced}개</span>}
                  {p.wardsDestroyed > 0 && <span>제거 {p.wardsDestroyed}개</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

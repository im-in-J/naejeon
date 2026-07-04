"use client";

import { useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getGroup, addMatch } from "@/lib/store";
import { calculateMvpScores } from "@/lib/mvp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ImagePlus,
  Loader2,
  Check,
  X,
  ChevronLeft,
  Sparkles,
  Save,
  AlertCircle,
} from "lucide-react";
import type { PlayerStat } from "@/lib/types";

type Step = "upload" | "analyzing" | "review";

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [step, setStep] = useState<Step>("upload");
  const [screenshots, setScreenshots] = useState<{ basic?: string; detail?: string }>({});
  const [players, setPlayers] = useState<Partial<PlayerStat>[]>([]);
  const [gameDuration, setGameDuration] = useState("");
  const [error, setError] = useState("");
  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (type: "basic" | "detail") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshots((prev) => ({ ...prev, [type]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleDrop = useCallback(
    (type: "basic" | "detail") => (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshots((prev) => ({ ...prev, [type]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const data = reader.result as string;
            if (!screenshots.basic) {
              setScreenshots((prev) => ({ ...prev, basic: data }));
            } else if (!screenshots.detail) {
              setScreenshots((prev) => ({ ...prev, detail: data }));
            }
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    },
    [screenshots]
  );

  const analyze = async () => {
    if (!screenshots.basic) {
      setError("기본 결과창 스크린샷을 업로드해주세요.");
      return;
    }

    setError("");
    setStep("analyzing");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basicScreenshot: screenshots.basic,
          detailScreenshot: screenshots.detail,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "분석에 실패했습니다.");
      }

      const data = await res.json();
      setPlayers(data.players || []);
      setGameDuration(data.gameDuration || "");
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석에 실패했습니다.");
      setStep("upload");
    }
  };

  const handleSave = () => {
    const completePlayers = players.map((p, i) => ({
      id: `p-${i}`,
      matchId: "",
      nickname: p.nickname || `Player ${i + 1}`,
      champion: p.champion || "",
      team: p.team || (i < 5 ? "blue" : "red"),
      win: p.win ?? false,
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      cs: p.cs ?? 0,
      gold: p.gold ?? 0,
      damageDealt: p.damageDealt ?? 0,
      damageTaken: p.damageTaken ?? 0,
      visionScore: p.visionScore ?? 0,
      wardsPlaced: p.wardsPlaced ?? 0,
      wardsDestroyed: p.wardsDestroyed ?? 0,
      objectiveDamage: p.objectiveDamage ?? 0,
      ccScore: p.ccScore ?? 0,
      healingDone: p.healingDone ?? 0,
      shieldingDone: p.shieldingDone ?? 0,
      killParticipation: 0,
      mvpScore: 0,
      isMvp: false,
      isAce: false,
    })) as PlayerStat[];

    const scored = calculateMvpScores(completePlayers);
    const match = addMatch(groupId, scored, gameDuration);
    router.push(`/group/${groupId}/match/${match.id}`);
  };

  const updatePlayer = (index: number, field: string, value: string | number | boolean) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  return (
    <div
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      onPaste={handlePaste}
    >
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-text-muted hover:text-text-primary mb-6 transition-fast cursor-pointer"
      >
        <ChevronLeft size={16} />
        돌아가기
      </button>

      <h1 className="text-2xl font-bold text-text-primary mb-2">경기 등록</h1>
      <p className="text-sm text-text-secondary mb-8">
        게임 결과 스크린샷을 업로드하면 AI가 자동으로 데이터를 추출합니다.
      </p>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic screenshot */}
            <DropZone
              label="1. 기본 결과창"
              desc="KDA, CS, 골드가 보이는 기본 탭"
              image={screenshots.basic}
              onDrop={handleDrop("basic")}
              onClear={() => setScreenshots((p) => ({ ...p, basic: undefined }))}
              onClickUpload={() => fileRef1.current?.click()}
              required
            />
            <input
              ref={fileRef1}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile("basic")}
            />

            {/* Detail screenshot */}
            <DropZone
              label="2. 상세 통계 탭"
              desc="딜량, 받은 피해량, 시야점수"
              image={screenshots.detail}
              onDrop={handleDrop("detail")}
              onClear={() => setScreenshots((p) => ({ ...p, detail: undefined }))}
              onClickUpload={() => fileRef2.current?.click()}
            />
            <input
              ref={fileRef2}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile("detail")}
            />
          </div>

          <p className="text-xs text-text-muted text-center">
            Ctrl+V로 클립보드에서 바로 붙여넣기도 가능합니다
          </p>

          {error && (
            <div className="flex items-center gap-2 text-sm text-lose bg-lose/10 border border-lose/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={analyze}
              disabled={!screenshots.basic}
            >
              <Sparkles size={18} />
              AI 분석 시작
            </Button>
          </div>
        </div>
      )}

      {/* Step: Analyzing */}
      {step === "analyzing" && (
        <Card className="text-center py-16">
          <Loader2 size={40} className="mx-auto text-accent animate-spin mb-4" />
          <p className="text-text-primary font-medium">스크린샷을 분석하고 있습니다...</p>
          <p className="text-sm text-text-muted mt-2">AI가 게임 데이터를 추출 중입니다</p>
        </Card>
      )}

      {/* Step: Review */}
      {step === "review" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={20} className="text-win" />
              <span className="font-medium text-text-primary">분석 완료 — 결과를 확인하세요</span>
            </div>
            <Input
              placeholder="게임 시간 (예: 32:15)"
              value={gameDuration}
              onChange={(e) => setGameDuration(e.target.value)}
              className="w-40"
            />
          </div>

          {/* Blue team */}
          <TeamReview
            team="blue"
            players={players.filter((_, i) => (players[i]?.team || (i < 5 ? "blue" : "red")) === "blue")}
            allPlayers={players}
            onUpdate={updatePlayer}
          />

          {/* Red team */}
          <TeamReview
            team="red"
            players={players.filter((_, i) => (players[i]?.team || (i < 5 ? "blue" : "red")) === "red")}
            allPlayers={players}
            onUpdate={updatePlayer}
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-lose bg-lose/10 border border-lose/20 rounded-xl px-4 py-3">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                setStep("upload");
                setPlayers([]);
              }}
            >
              다시 업로드
            </Button>
            <Button size="lg" onClick={handleSave}>
              <Save size={18} />
              저장하기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropZone({
  label,
  desc,
  image,
  onDrop,
  onClear,
  onClickUpload,
  required,
}: {
  label: string;
  desc: string;
  image?: string;
  onDrop: (e: React.DragEvent) => void;
  onClear: () => void;
  onClickUpload: () => void;
  required?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      className={`drop-zone rounded-2xl p-6 flex flex-col items-center justify-center min-h-[200px] relative ${
        dragOver ? "active" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        onDrop(e);
      }}
      onClick={() => !image && onClickUpload()}
    >
      {image ? (
        <>
          <img src={image} alt={label} className="max-h-48 rounded-lg object-contain" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-bg-card text-text-muted hover:text-lose transition-fast cursor-pointer"
          >
            <X size={16} />
          </button>
        </>
      ) : (
        <div className="text-center cursor-pointer">
          <ImagePlus size={32} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm font-medium text-text-primary">{label}</p>
          <p className="text-xs text-text-muted mt-1">{desc}</p>
          {required && (
            <span className="text-xs text-accent mt-2 inline-block">필수</span>
          )}
        </div>
      )}
    </div>
  );
}

function TeamReview({
  team,
  players,
  allPlayers,
  onUpdate,
}: {
  team: "blue" | "red";
  players: Partial<PlayerStat>[];
  allPlayers: Partial<PlayerStat>[];
  onUpdate: (index: number, field: string, value: string | number | boolean) => void;
}) {
  const teamColor = team === "blue" ? "text-blue-400" : "text-red-400";
  const teamBg = team === "blue" ? "bg-blue-500/10 border-blue-500/20" : "bg-red-500/10 border-red-500/20";

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <div className={`px-3 py-1 rounded-lg border text-sm font-bold ${teamBg} ${teamColor}`}>
          {team === "blue" ? "블루팀" : "레드팀"}
        </div>
        {players.length > 0 && (
          <Badge variant={players[0]?.win ? "win" : "lose"}>
            {players[0]?.win ? "승리" : "패배"}
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-xs border-b border-border">
              <th className="text-left py-2 px-2">닉네임</th>
              <th className="text-left py-2 px-2">챔피언</th>
              <th className="text-center py-2 px-1">K</th>
              <th className="text-center py-2 px-1">D</th>
              <th className="text-center py-2 px-1">A</th>
              <th className="text-center py-2 px-1">CS</th>
              <th className="text-right py-2 px-1">딜량</th>
              <th className="text-right py-2 px-1">피해량</th>
              <th className="text-center py-2 px-1">시야</th>
              <th className="text-center py-2 px-1">승패</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const idx = allPlayers.indexOf(p);
              return (
                <tr key={idx} className="border-b border-border/50 hover:bg-bg-card-hover transition-colors">
                  <td className="py-2 px-2">
                    <input
                      className="bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none w-24 text-text-primary"
                      value={p.nickname || ""}
                      onChange={(e) => onUpdate(idx, "nickname", e.target.value)}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      className="bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none w-20 text-text-primary"
                      value={p.champion || ""}
                      onChange={(e) => onUpdate(idx, "champion", e.target.value)}
                    />
                  </td>
                  <td className="text-center py-2 px-1">
                    <NumInput value={p.kills} onChange={(v) => onUpdate(idx, "kills", v)} />
                  </td>
                  <td className="text-center py-2 px-1">
                    <NumInput value={p.deaths} onChange={(v) => onUpdate(idx, "deaths", v)} />
                  </td>
                  <td className="text-center py-2 px-1">
                    <NumInput value={p.assists} onChange={(v) => onUpdate(idx, "assists", v)} />
                  </td>
                  <td className="text-center py-2 px-1">
                    <NumInput value={p.cs} onChange={(v) => onUpdate(idx, "cs", v)} />
                  </td>
                  <td className="text-right py-2 px-1">
                    <NumInput value={p.damageDealt} onChange={(v) => onUpdate(idx, "damageDealt", v)} w="w-16" />
                  </td>
                  <td className="text-right py-2 px-1">
                    <NumInput value={p.damageTaken} onChange={(v) => onUpdate(idx, "damageTaken", v)} w="w-16" />
                  </td>
                  <td className="text-center py-2 px-1">
                    <NumInput value={p.visionScore} onChange={(v) => onUpdate(idx, "visionScore", v)} />
                  </td>
                  <td className="text-center py-2 px-1">
                    <select
                      className="bg-bg-input border border-border rounded px-1 py-0.5 text-xs text-text-primary cursor-pointer"
                      value={p.win ? "win" : "lose"}
                      onChange={(e) => onUpdate(idx, "win", e.target.value === "win")}
                    >
                      <option value="win">승</option>
                      <option value="lose">패</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function NumInput({
  value,
  onChange,
  w = "w-10",
}: {
  value?: number;
  onChange: (v: number) => void;
  w?: string;
}) {
  return (
    <input
      type="number"
      className={`${w} bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none text-center text-text-primary text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      value={value ?? 0}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    />
  );
}

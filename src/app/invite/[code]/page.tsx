"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getGroupByInvite } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Swords, Users, Gamepad2 } from "lucide-react";
import type { Group } from "@/lib/types";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);

  const code = params.code as string;

  useEffect(() => {
    const g = getGroupByInvite(code);
    setGroup(g);
  }, [code]);

  if (group === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">로딩 중...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="text-center max-w-sm mx-auto">
          <Swords size={40} className="mx-auto text-text-muted mb-4" />
          <h2 className="text-lg font-bold text-text-primary mb-2">유효하지 않은 초대</h2>
          <p className="text-sm text-text-secondary mb-4">
            이 초대 링크가 만료되었거나 존재하지 않습니다.
          </p>
          <Button onClick={() => router.push("/")}>홈으로</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
          <Users size={28} className="text-accent" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-1">{group.name}</h2>
        <p className="text-sm text-text-muted mb-6">
          {group.members.length}명 참여 · {group.matches.length}경기 기록
        </p>
        <Button size="lg" className="w-full" onClick={() => router.push(`/group/${group.id}`)}>
          <Gamepad2 size={18} />
          그룹 참여하기
        </Button>
      </Card>
    </div>
  );
}

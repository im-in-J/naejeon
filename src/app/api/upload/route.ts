import { NextRequest, NextResponse } from "next/server";

const UPLOAD_SECRET = process.env.UPLOAD_SECRET || "naejeon-upload-2024";

export async function POST(req: NextRequest) {
  try {
    const { secret, match } = await req.json();

    // 시크릿 검증
    if (secret !== UPLOAD_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!match || !match.players || match.players.length === 0) {
      return NextResponse.json({ error: "Invalid match data" }, { status: 400 });
    }

    // 현재는 클라이언트에서 localStorage를 쓰므로
    // 서버에서는 매치 데이터를 JSON으로 저장해두고
    // 클라이언트가 폴링해서 가져가는 구조
    // 추후 DB 연동 시 여기서 직접 저장

    // 임시: 파일 기반 큐 (Vercel의 /tmp 디렉토리)
    const fs = await import("fs");
    const path = await import("path");

    const queueDir = path.join("/tmp", "naejeon-queue");
    if (!fs.existsSync(queueDir)) {
      fs.mkdirSync(queueDir, { recursive: true });
    }

    const filename = `match-${Date.now()}.json`;
    const filepath = path.join(queueDir, filename);

    fs.writeFileSync(
      filepath,
      JSON.stringify({
        ...match,
        uploadedAt: new Date().toISOString(),
      })
    );

    console.log(`Match uploaded: ${filename}, ${match.players.length} players, ${match.gameDuration}`);

    return NextResponse.json({
      success: true,
      matchId: filename,
      players: match.players.length,
      duration: match.gameDuration,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

// 대기 중인 매치 목록 조회 (클라이언트 폴링용)
export async function GET(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get("secret");
    if (secret !== UPLOAD_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fs = await import("fs");
    const path = await import("path");

    const queueDir = path.join("/tmp", "naejeon-queue");
    if (!fs.existsSync(queueDir)) {
      return NextResponse.json({ matches: [] });
    }

    const files = fs.readdirSync(queueDir).filter((f: string) => f.endsWith(".json"));
    const matches = files.map((f: string) => {
      const content = fs.readFileSync(path.join(queueDir, f), "utf-8");
      return { id: f, ...JSON.parse(content) };
    });

    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json({ matches: [] });
  }
}

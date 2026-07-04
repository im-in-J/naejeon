import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(req: NextRequest) {
  const filePath = join(process.cwd(), "collector", "collector.py");
  const content = readFileSync(filePath, "utf-8");

  // 서버 URL을 현재 호스트로 자동 치환
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const serverUrl = `${protocol}://${host}`;
  const patched = content.replace(
    'SERVER_URL = "https://your-site.vercel.app"',
    `SERVER_URL = "${serverUrl}"`
  );

  return new NextResponse(patched, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="naejeon-collector.py"',
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(req: NextRequest) {
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const serverUrl = `${protocol}://${host}`;

  // Read and patch collector.py
  const pyPath = join(process.cwd(), "collector", "collector.py");
  let pyContent: string;
  try {
    pyContent = readFileSync(pyPath, "utf-8");
  } catch (err) {
    console.error("collector.py not found in server bundle:", err);
    return NextResponse.json(
      { error: "수집기 파일을 찾을 수 없습니다 (서버 번들 누락)" },
      { status: 500 }
    );
  }
  pyContent = pyContent.replace(
    'SERVER_URL = "https://your-site.vercel.app"',
    `SERVER_URL = "${serverUrl}"`
  );
  // 서버에 UPLOAD_SECRET 환경변수가 설정돼 있으면 수집기에도 동일하게 심어줌
  if (process.env.UPLOAD_SECRET) {
    pyContent = pyContent.replace(
      'UPLOAD_SECRET = "naejeon-upload-2024"',
      `UPLOAD_SECRET = ${JSON.stringify(process.env.UPLOAD_SECRET)}`
    );
  }

  // Read bat file
  const batPath = join(process.cwd(), "collector", "내전수집기.bat");
  let batContent: string;
  try {
    batContent = readFileSync(batPath, "utf-8");
  } catch (err) {
    console.error("내전수집기.bat not found in server bundle, using fallback:", err);
    batContent = '@echo off\npython "%~dp0naejeon-collector.py"\npause';
  }
  // cmd는 CRLF 필수 — LF-only면 한글 bat에서 파싱이 깨져 유령 명령 에러 발생
  batContent = batContent.replace(/\r?\n/g, "\r\n");

  // Build a simple ZIP file manually (no external deps)
  const files = [
    { name: "naejeon-collector.py", data: Buffer.from(pyContent, "utf-8") },
    { name: "내전수집기.bat", data: Buffer.from(batContent, "utf-8") },
  ];

  const zip = buildZip(files);

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="naejeon-collector.zip"',
    },
  });
}

// Minimal ZIP builder (no dependencies)
function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const entries: Buffer[] = [];
  const centralDir: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf-8");
    const crc = crc32(file.data);

    // Local file header
    const localHeader = Buffer.alloc(30 + nameBuffer.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(1 << 11, 6); // flags (UTF-8)
    localHeader.writeUInt16LE(0, 8); // compression (store)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14); // crc32
    localHeader.writeUInt32LE(file.data.length, 18); // compressed size
    localHeader.writeUInt32LE(file.data.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26); // name length
    localHeader.writeUInt16LE(0, 28); // extra length
    nameBuffer.copy(localHeader, 30);

    entries.push(localHeader, file.data);

    // Central directory entry
    const cdEntry = Buffer.alloc(46 + nameBuffer.length);
    cdEntry.writeUInt32LE(0x02014b50, 0); // signature
    cdEntry.writeUInt16LE(20, 4); // version made by
    cdEntry.writeUInt16LE(20, 6); // version needed
    cdEntry.writeUInt16LE(1 << 11, 8); // flags (UTF-8)
    cdEntry.writeUInt16LE(0, 10); // compression
    cdEntry.writeUInt16LE(0, 12); // mod time
    cdEntry.writeUInt16LE(0, 14); // mod date
    cdEntry.writeUInt32LE(crc, 16); // crc32
    cdEntry.writeUInt32LE(file.data.length, 20); // compressed size
    cdEntry.writeUInt32LE(file.data.length, 24); // uncompressed size
    cdEntry.writeUInt16LE(nameBuffer.length, 28); // name length
    cdEntry.writeUInt16LE(0, 30); // extra length
    cdEntry.writeUInt16LE(0, 32); // comment length
    cdEntry.writeUInt16LE(0, 34); // disk start
    cdEntry.writeUInt16LE(0, 36); // internal attr
    cdEntry.writeUInt32LE(0, 38); // external attr
    cdEntry.writeUInt32LE(offset, 42); // local header offset
    nameBuffer.copy(cdEntry, 46);

    centralDir.push(cdEntry);
    offset += localHeader.length + file.data.length;
  }

  const cdSize = centralDir.reduce((s, b) => s + b.length, 0);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // cd start disk
  eocd.writeUInt16LE(files.length, 8); // entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(cdSize, 12); // cd size
  eocd.writeUInt32LE(offset, 16); // cd offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...entries, ...centralDir, eocd]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

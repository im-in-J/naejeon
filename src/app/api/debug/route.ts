import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    hasUrl: !!url,
    urlPrefix: url ? url.substring(0, 30) + "..." : "NOT SET",
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 20) + "..." : "NOT SET",
    uploadSecret: !!process.env.UPLOAD_SECRET,
  });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const envCheck = {
    hasUrl: !!url,
    urlPrefix: url ? url.substring(0, 30) + "..." : "NOT SET",
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 20) + "..." : "NOT SET",
    uploadSecret: !!process.env.UPLOAD_SECRET,
  };

  if (!url || !key) {
    return NextResponse.json({ ...envCheck, db: "ENV NOT SET" });
  }

  try {
    const supabase = createClient(url, key);

    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true });

    const { data: members, error: memberErr } = await supabase
      .from("members")
      .select("nickname", { count: "exact", head: true });

    return NextResponse.json({
      ...envCheck,
      db: "CONNECTED",
      matchesTable: matchErr ? { error: matchErr.message, code: matchErr.code } : "OK",
      membersTable: memberErr ? { error: memberErr.message, code: memberErr.code } : "OK",
    });
  } catch (err) {
    return NextResponse.json({
      ...envCheck,
      db: "CONNECTION_FAILED",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

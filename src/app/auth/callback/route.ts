import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  // Validate before use: only internal relative paths are allowed (no open redirect).
  const next = safeNextPath(url.searchParams.get("next"));
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return NextResponse.redirect(new URL(`/?auth_error=1`, origin));
}

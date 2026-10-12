import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureAccount } from "@/lib/account/ensure-account";
import { decidePostLogin } from "@/lib/account/decide-post-login";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const failure = () => NextResponse.redirect(new URL("/?auth_error=1", origin));

  if (!code) return failure();

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failure();

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return failure();

  try {
    // `as` only matters when the account does not exist yet; ensureAccount never changes an existing role.
    const decision = await ensureAccount({
      userId: user.id,
      email: user.email ?? null,
      displayName: (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined) ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      intent: url.searchParams.get("as"),
    });
    // decidePostLogin validates `next` (same-origin path, allowed for the role).
    const target = decidePostLogin({ role: decision.role, next: url.searchParams.get("next"), mismatch: decision.mismatch });
    return NextResponse.redirect(new URL(target, origin));
  } catch (e) {
    console.error("account setup failed", e);
    await supabase.auth.signOut();
    return failure();
  }
}

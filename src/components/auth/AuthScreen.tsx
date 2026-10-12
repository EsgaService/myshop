import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginButton } from "@/components/LoginButton";
import { AuthCard } from "@/components/ui/AuthCard";
import { decidePostLogin } from "@/lib/account/decide-post-login";
import type { AccountRole } from "@/lib/account/decide-role";
import { safeNextPath } from "@/lib/auth/safe-next";
import { authScreen, wrongScreenRedirect } from "@/lib/auth/screens";
import { getProfile } from "@/lib/data/queries";

/** Combined login/register screen for one role (Google only). */
export async function AuthScreen({ role, next }: { role: AccountRole; next?: string }) {
  const screen = authScreen(role);
  const profile = await getProfile();

  if (profile) {
    // Never switch roles: a mismatching user is sent home with a notice.
    const wrong = wrongScreenRedirect({ role: profile.role, screen: role });
    redirect(wrong ?? decidePostLogin({ role: profile.role, next, mismatch: false }));
  }

  return (
    <AuthCard
      title={screen.title}
      text={screen.text}
      note={screen.note}
      footer={
        <Link href={screen.switchLink.href} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          {screen.switchLink.label}
        </Link>
      }
    >
      <LoginButton as={screen.as} next={safeNextPath(next, screen.defaultNext)} label="Continuar con Google" />
    </AuthCard>
  );
}

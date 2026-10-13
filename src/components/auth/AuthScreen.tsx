import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginButton } from "@/components/LoginButton";
import { AuthCard } from "@/components/ui/AuthCard";
import { Notice } from "@/components/ui/Notice";
import { decidePostLogin } from "@/lib/account/decide-post-login";
import type { AccountRole } from "@/lib/account/decide-role";
import type { AuthMode } from "@/lib/auth/auth-mode";
import { safeNextPath } from "@/lib/auth/safe-next";
import { authScreen, avisoMessage, wrongScreenRedirect } from "@/lib/auth/screens";
import { getProfile } from "@/lib/data/queries";

/** Sign-in / sign-up screen for one role (Google only). Terms are required only when creating an account. */
export async function AuthScreen({ role, mode, next, aviso }: { role: AccountRole; mode: AuthMode; next?: string; aviso?: string }) {
  const profile = await getProfile();

  if (profile) {
    // Never switch roles: a mismatching user is sent home with a notice.
    const wrong = wrongScreenRedirect({ role: profile.role, screen: role });
    redirect(wrong ?? decidePostLogin({ role: profile.role, next, mismatch: false }));
  }

  const safeNext = safeNextPath(next, "");
  const screen = authScreen(role, mode, safeNext || null);
  const notice = mode === "crear" ? avisoMessage(aviso, null) : null;

  return (
    <AuthCard
      title={screen.title}
      text={screen.text}
      note={screen.note}
      footer={
        <div className="flex flex-col items-center gap-2">
          <Link href={screen.modeLink.href} className="font-medium text-fg underline-offset-4 hover:text-primary hover:underline">
            {screen.modeLink.label}
          </Link>
          <Link href={screen.switchLink.href} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
            {screen.switchLink.label}
          </Link>
        </div>
      }
    >
      <div>
        {notice && <Notice>{notice}</Notice>}
        <LoginButton
          key={mode}
          as={screen.as}
          next={safeNext || screen.defaultNext}
          label="Continuar con Google"
          requireConsent={screen.requiresConsent}
        />
      </div>
    </AuthCard>
  );
}

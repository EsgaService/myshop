import Link from "next/link";
import { LANDING } from "@/lib/landing/content";
import { Logo } from "@/components/ui/Logo";

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-fg-muted sm:flex-row sm:px-6">
        <Logo className="text-lg" />
        <nav aria-label="Legal" className="flex gap-5">
          {LANDING.footer.links.map((l) => (
            <Link key={l.href} href={l.href} className="underline-offset-4 transition-colors hover:text-fg hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="font-mono text-xs">&copy; {new Date().getFullYear()} Recetarios</p>
      </div>
    </footer>
  );
}

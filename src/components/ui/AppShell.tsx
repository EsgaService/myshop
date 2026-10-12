import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

export type NavItem = { label: string; href: string };

/** Responsive shell: top bar + sidebar (a horizontal strip above content on small screens). */
export function AppShell({
  title,
  nav,
  footerLink,
  actions,
  children,
}: {
  title: string;
  nav: NavItem[];
  footerLink?: NavItem;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[16rem] truncate text-sm font-medium text-fg-muted sm:block">{title}</span>
            {actions}
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[14rem_1fr]">
        <aside className="md:sticky md:top-20 md:self-start">
          <nav aria-label="Principal" className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
              >
                {item.label}
              </Link>
            ))}
            {footerLink && (
              <Link href={footerLink.href} className="whitespace-nowrap rounded-xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary md:mt-4">
                {footerLink.label}
              </Link>
            )}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

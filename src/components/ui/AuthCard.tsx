import type { ReactNode } from "react";
import { Card } from "./Card";
import { Logo } from "./Logo";

export function AuthCard({
  title,
  text,
  note = "Si no tienes cuenta, la creamos automáticamente.",
  footer,
  children,
}: {
  title: string;
  text: string;
  note?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <Card className="p-8 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-fg-muted">{text}</p>
          <div className="mt-6 flex justify-center">{children}</div>
          <p className="mt-5 text-xs text-fg-muted">{note}</p>
        </Card>
        {footer && <div className="mt-5 text-center text-sm">{footer}</div>}
      </div>
    </main>
  );
}

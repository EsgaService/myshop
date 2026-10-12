import type { ReactNode } from "react";
import { Card } from "./Card";
import { Logo } from "./Logo";

export function AuthCard({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <Card className="p-8 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-fg-muted">{text}</p>
          <div className="mt-6 flex justify-center">{children}</div>
          <p className="mt-5 text-xs text-fg-muted">Si no tienes cuenta, la creamos automáticamente.</p>
        </Card>
      </div>
    </main>
  );
}

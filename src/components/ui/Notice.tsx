import type { ReactNode } from "react";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="mb-6 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-fg">
      {children}
    </div>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "primary";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-fg-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  primary: "bg-primary-soft text-primary",
};

export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wider", TONES[tone], className)}
      {...rest}
    />
  );
}

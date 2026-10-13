import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-border bg-surface shadow-soft", className)} {...rest} />;
}

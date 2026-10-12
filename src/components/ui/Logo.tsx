import Link from "next/link";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/ui/cn";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-display text-xl font-semibold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-fg">
        <BookOpenText size={18} weight="bold" aria-hidden />
      </span>
      Recetarios
    </Link>
  );
}

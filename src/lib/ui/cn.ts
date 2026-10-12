export type ClassValue = string | false | null | undefined;

/** Joins truthy class names. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "outline" | "ghost" | "inverse" | "inverse-outline";
export type ButtonSize = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg shadow-soft hover:bg-primary-hover",
  outline: "border border-border-strong bg-surface text-fg hover:bg-surface-muted",
  ghost: "text-fg hover:bg-surface-muted",
  inverse: "bg-surface text-fg shadow-soft hover:bg-surface-muted",
  "inverse-outline": "border border-white/40 text-primary-fg hover:bg-white/10",
};

const SIZES: Record<ButtonSize, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-8 text-base",
};

/** Class string shared by <Button> and link-styled buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/lib/ui/cn";

type Shared = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...rest
}: Shared & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...rest} />;
}

export function ButtonLink({ variant, size, className, ...rest }: Shared & ComponentProps<typeof Link>) {
  return <Link className={buttonClasses({ variant, size, className })} {...rest} />;
}

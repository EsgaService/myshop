"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/Field";
import { caretAfterFormat, formatPriceInput } from "@/lib/books/price";

/**
 * Controlled price input in whole pesos: the seller types plain digits and sees thousands separators
 * live. The submitted value is the formatted text; the server parses and bounds it again.
 */
export function PriceField({
  id,
  name = "price",
  initialCents = 0,
  disabled,
  describedBy,
  onValueChange,
}: {
  id: string;
  name?: string;
  /** Stored price in cents; 0 renders an empty field. */
  initialCents?: number;
  disabled?: boolean;
  describedBy?: string;
  onValueChange?: (digits: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(() => (initialCents > 0 ? formatPriceInput(String(initialCents / 100)).display : ""));

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const caret = input.selectionStart ?? input.value.length;
    const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, "").replace(/^0+/, "").length;
    const next = formatPriceInput(input.value);
    setDisplay(next.display);
    onValueChange?.(next.digits);
    // Keep the caret next to the same digit after React re-renders the formatted text.
    requestAnimationFrame(() => {
      const position = caretAfterFormat(next.display, Math.min(digitsBeforeCaret, next.digits.length));
      ref.current?.setSelectionRange(position, position);
    });
  }

  return (
    <Input
      ref={ref}
      id={id}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      value={display}
      onChange={handleChange}
      disabled={disabled}
      placeholder="Ej: 19900"
      className="h-10 w-40 font-mono"
      aria-describedby={describedBy}
    />
  );
}

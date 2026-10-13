import { isUuid } from "@/lib/ids";

export type ParsedImageChoice =
  | { type: "candidate"; imageId: string }
  | { type: "custom"; imageId: string }
  | { type: "clear" }
  | { type: "remove" };

/** Shapes the untrusted client input of a cover / recipe photo choice. Returns null when it is malformed. */
export function parseImageChoice(input: unknown): ParsedImageChoice | null {
  if (typeof input !== "object" || input === null) return null;
  const { type, imageId } = input as { type?: unknown; imageId?: unknown };
  if (type === "clear" || type === "remove") return { type };
  if ((type === "candidate" || type === "custom") && isUuid(imageId)) return { type, imageId };
  return null;
}

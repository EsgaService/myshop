const MAX_LENGTH = 2048;
const BACKSLASH = String.fromCharCode(92);
// Whitespace, control characters and backslashes are never valid in an internal path.
const FORBIDDEN = new RegExp("[\\s\\u0000-\\u001f\\u007f" + "\\\\" + "]");

/**
 * Validates a post-login redirect target. Only same-origin relative paths
 * ("/something") are accepted; anything else falls back to `fallback`.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || next.length > MAX_LENGTH) return fallback;
  if (!next.startsWith("/")) return fallback;
  // "//host" and "/\host" are treated by browsers as external hosts.
  if (next.startsWith("//") || next.startsWith("/" + BACKSLASH)) return fallback;
  if (FORBIDDEN.test(next)) return fallback;
  // Reject encoded CR/LF/backslash/slashes that decode into the cases above.
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (FORBIDDEN.test(decoded) || decoded.startsWith("//")) return fallback;
  return next;
}

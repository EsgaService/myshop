function absoluteHttpOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Public origin used to build return URLs. The configured site URL wins; outside production the request
 * origin is an acceptable fallback. In production it is never trusted (the Host header can be spoofed).
 */
export function resolveSiteOrigin(input: {
  siteUrl: string | undefined;
  requestOrigin: string | undefined;
  nodeEnv: string | undefined;
}): string | null {
  const configured = absoluteHttpOrigin(input.siteUrl);
  if (configured) return configured;
  if (input.nodeEnv === "production") return null;
  return absoluteHttpOrigin(input.requestOrigin);
}

/** Origin from the incoming request headers (for server actions, which have no Request). */
export function originFromHeaders(headers: Headers): string | undefined {
  const host = headers.get("host");
  if (!host || !/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) return undefined;
  const proto = headers.get("x-forwarded-proto") === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

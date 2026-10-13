/**
 * Tiny in-memory fixed-window limiter. Per server instance only: a cheap guard against a signed-in user
 * hammering an endpoint that calls an external API, not a security boundary.
 */
export function createRateLimiter(options: { max: number; windowMs: number; now?: () => number; maxKeys?: number }) {
  const now = options.now ?? Date.now;
  const maxKeys = options.maxKeys ?? 1000;
  const hits = new Map<string, { start: number; count: number }>();

  return {
    hit(key: string): boolean {
      const t = now();
      const entry = hits.get(key);
      if (!entry || t - entry.start >= options.windowMs) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (t - v.start >= options.windowMs) hits.delete(k);
          // Still full: drop the oldest entry.
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value as string);
        }
        hits.set(key, { start: t, count: 1 });
        return true;
      }
      entry.count += 1;
      return entry.count <= options.max;
    },
    size: () => hits.size,
  };
}

import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to max hits per window per key", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 3, windowMs: 1000, now: () => t });
    expect([limiter.hit("u1"), limiter.hit("u1"), limiter.hit("u1"), limiter.hit("u1")]).toEqual([true, true, true, false]);
  });

  it("keeps keys independent and resets after the window", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => t });
    expect(limiter.hit("a")).toBe(true);
    expect(limiter.hit("a")).toBe(false);
    expect(limiter.hit("b")).toBe(true);
    t = 1001;
    expect(limiter.hit("a")).toBe(true);
  });

  it("does not grow without bound", () => {
    let t = 0;
    const limiter = createRateLimiter({ max: 1, windowMs: 10, now: () => t, maxKeys: 5 });
    for (let i = 0; i < 20; i++) limiter.hit(`k${i}`);
    expect(limiter.size()).toBeLessThanOrEqual(5);
  });
});

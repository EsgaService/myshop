import { describe, expect, it } from "vitest";
import { aiBootIssue } from "./boot-check";

describe("aiBootIssue", () => {
  it("flags the mock AI provider in production", () => {
    expect(aiBootIssue({ NODE_ENV: "production" })).toMatch(/mock/i);
    expect(aiBootIssue({ NODE_ENV: "production", AI_PROVIDER: "mock", ANTHROPIC_API_KEY: "k" })).toMatch(/mock/i);
  });
  it.each([
    { NODE_ENV: "production", ANTHROPIC_API_KEY: "k" },
    { NODE_ENV: "production", AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" },
    { NODE_ENV: "development" },
    { NODE_ENV: "test", AI_PROVIDER: "mock" },
  ])("is silent for %j", (env) => {
    expect(aiBootIssue(env)).toBeNull();
  });
});

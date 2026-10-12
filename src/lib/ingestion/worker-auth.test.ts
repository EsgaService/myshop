import { describe, expect, it } from "vitest";
import { isAuthorizedWorkerRequest } from "./worker-auth";

describe("isAuthorizedWorkerRequest", () => {
  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedWorkerRequest("Bearer s3cret-value", "s3cret-value")).toBe(true);
  });

  it("rejects wrong, missing or malformed credentials", () => {
    expect(isAuthorizedWorkerRequest("Bearer nope", "s3cret-value")).toBe(false);
    expect(isAuthorizedWorkerRequest(null, "s3cret-value")).toBe(false);
    expect(isAuthorizedWorkerRequest("s3cret-value", "s3cret-value")).toBe(false);
    expect(isAuthorizedWorkerRequest("Basic s3cret-value", "s3cret-value")).toBe(false);
    expect(isAuthorizedWorkerRequest("Bearer s3cret-value-extra", "s3cret-value")).toBe(false);
  });

  it("fails closed when no secret is configured", () => {
    expect(isAuthorizedWorkerRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedWorkerRequest("Bearer anything", "")).toBe(false);
    expect(isAuthorizedWorkerRequest("Bearer undefined", undefined)).toBe(false);
  });
});

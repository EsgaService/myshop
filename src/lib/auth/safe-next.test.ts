import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

const BS = String.fromCharCode(92);

describe("safeNextPath", () => {
  it.each(["/cocteles", "/cocteles/recetario", "/cocteles/pagar?x=1", "/"])("accepts %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });
  it.each([
    "https://evil.com",
    "//evil.com",
    "/" + BS + "evil.com",
    BS + BS + "evil.com",
    "javascript:alert(1)",
    "evil.com",
    "/%0d%0aSet-Cookie:x=1",
    "/%5cevil.com",
    "/a\nb",
    "/ /evil",
    "///evil.com",
    "/\t/evil.com",
  ])("rejects %j", (p) => {
    expect(safeNextPath(p)).toBe("/");
  });
  it("falls back for null, undefined and empty", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });
  it("uses a custom fallback", () => {
    expect(safeNextPath("//x.com", "/home")).toBe("/home");
  });
  it("rejects overly long values", () => {
    expect(safeNextPath("/" + "a".repeat(3000))).toBe("/");
  });
});

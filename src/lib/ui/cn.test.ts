import { describe, expect, it } from "vitest";
import { buttonClasses, cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names and drops falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
});

describe("buttonClasses", () => {
  it("defaults to a medium primary pill button", () => {
    const c = buttonClasses();
    expect(c).toContain("rounded-full");
    expect(c).toContain("bg-primary");
    expect(c).toContain("h-11");
  });

  it("supports outline, ghost and large variants", () => {
    expect(buttonClasses({ variant: "outline" })).toContain("border");
    expect(buttonClasses({ variant: "outline" })).not.toContain("bg-primary");
    expect(buttonClasses({ variant: "ghost" })).toContain("hover:bg-surface-muted");
    expect(buttonClasses({ size: "lg" })).toContain("h-14");
  });

  it("supports inverse variants for use on primary surfaces", () => {
    expect(buttonClasses({ variant: "inverse" })).toContain("bg-surface");
    expect(buttonClasses({ variant: "inverse-outline" })).toContain("border-white/40");
  });

  it("appends extra classes", () => {
    expect(buttonClasses({ className: "w-full" })).toContain("w-full");
  });
});

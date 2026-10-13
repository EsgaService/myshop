import { describe, expect, it } from "vitest";
import { parseImageChoice } from "./parse-image-choice";

const ID = "22222222-2222-4222-8222-222222222222";

describe("parseImageChoice", () => {
  it("parses a candidate and a custom choice with a valid image id", () => {
    expect(parseImageChoice({ type: "candidate", imageId: ID })).toEqual({ type: "candidate", imageId: ID });
    expect(parseImageChoice({ type: "custom", imageId: ID })).toEqual({ type: "custom", imageId: ID });
  });
  it("parses clear and remove without an image id", () => {
    expect(parseImageChoice({ type: "clear" })).toEqual({ type: "clear" });
    expect(parseImageChoice({ type: "remove" })).toEqual({ type: "remove" });
  });
  it("rejects unknown types, bad ids and non-objects", () => {
    expect(parseImageChoice({ type: "candidate", imageId: "x" })).toBeNull();
    expect(parseImageChoice({ type: "candidate" })).toBeNull();
    expect(parseImageChoice({ type: "weird" })).toBeNull();
    expect(parseImageChoice(null)).toBeNull();
    expect(parseImageChoice("candidate")).toBeNull();
  });
});

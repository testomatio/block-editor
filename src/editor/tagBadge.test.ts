import { describe, expect, it } from "vitest";
import { detectTags } from "./tagBadge";

describe("detectTags", () => {
  it("detects a single tag at the start of the string", () => {
    expect(detectTags("@smoke")).toEqual([{ start: 0, end: 6, tag: "@smoke" }]);
  });

  it("detects a tag that follows a space", () => {
    // "Login flow @smoke" — the @ is at index 11.
    expect(detectTags("Login flow @smoke")).toEqual([
      { start: 11, end: 17, tag: "@smoke" },
    ]);
  });

  it("detects multiple tags in one title", () => {
    const matches = detectTags("Login flow @smoke @regression");
    expect(matches).toEqual([
      { start: 11, end: 17, tag: "@smoke" },
      { start: 18, end: 29, tag: "@regression" },
    ]);
  });

  it("detects tags that contain allowed symbols", () => {
    expect(detectTags("@severity:high")).toEqual([
      { start: 0, end: 14, tag: "@severity:high" },
    ]);
    expect(detectTags("@T1234abcd")).toEqual([
      { start: 0, end: 10, tag: "@T1234abcd" },
    ]);
    expect(detectTags("@a-b_c")).toEqual([{ start: 0, end: 6, tag: "@a-b_c" }]);
    expect(detectTags("@group(1)")).toEqual([
      { start: 0, end: 9, tag: "@group(1)" },
    ]);
    expect(detectTags("@key=value")).toEqual([
      { start: 0, end: 10, tag: "@key=value" },
    ]);
  });

  it("detects a tag after a tab character", () => {
    expect(detectTags("title\t@flaky")).toEqual([
      { start: 6, end: 12, tag: "@flaky" },
    ]);
  });

  it("does not match an email address", () => {
    // The `@` is preceded by a word character, not start/whitespace.
    expect(detectTags("Contact user@example.com")).toEqual([]);
  });

  it("does not match a bare @ with no body", () => {
    expect(detectTags("just an @ symbol")).toEqual([]);
  });

  it("does not match @ in the middle of a word", () => {
    expect(detectTags("foo@bar")).toEqual([]);
  });

  it("returns an empty array for text without tags", () => {
    expect(detectTags("A plain heading title")).toEqual([]);
  });

  it("ignores a trailing dot that is not a valid tag terminator", () => {
    // The tag must end with a word char or `)`, so the trailing `.` is excluded.
    expect(detectTags("end of @smoke.")).toEqual([
      { start: 7, end: 13, tag: "@smoke" },
    ]);
  });

  it("does not keep stale regex state across calls", () => {
    // Guards against a shared lastIndex leaking between invocations.
    expect(detectTags("@one")).toEqual([{ start: 0, end: 4, tag: "@one" }]);
    expect(detectTags("@two")).toEqual([{ start: 0, end: 4, tag: "@two" }]);
  });
});

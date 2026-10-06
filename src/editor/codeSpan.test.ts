import { describe, expect, it } from "vitest";
import { codeBlockFence, indexOfOutsideCode, scanCodeSpan, wrapCodeSpan } from "./codeSpan";

describe("scanCodeSpan", () => {
  it("returns null when the index is not a backtick", () => {
    expect(scanCodeSpan("abc", 0)).toBeNull();
  });

  it.each([
    ["`foo`", "foo"],
    ["`` foo ` bar ``", "foo ` bar"],
    ["` `` `", "``"],
    ["`  ``  `", " `` "],
    ["` a`", " a"],
    ["` `", " "],
    ["`foo\\`", "foo\\"],
    ["``\nfoo\nbar  \nbaz\n``", "foo bar   baz"],
  ])("reads %j as the code %j (CommonMark examples)", (text, content) => {
    expect(scanCodeSpan(text, 0)).toEqual({ kind: "span", content, end: text.length });
  });

  it("does not close on a run of a different length", () => {
    expect(scanCodeSpan("```foo``", 0)).toEqual({ kind: "literal", end: 3 });
    expect(scanCodeSpan("`foo``bar``", 0)).toEqual({ kind: "literal", end: 1 });
  });
});

describe("wrapCodeSpan", () => {
  it.each(["foo", "a`b", "``", "`code`", " a ", "a``b`c"])("round-trips %j", (content) => {
    const wrapped = wrapCodeSpan(content);
    expect(scanCodeSpan(wrapped, 0)).toEqual({ kind: "span", content, end: wrapped.length });
  });

  it("uses the shortest delimiter that works", () => {
    expect(wrapCodeSpan("foo")).toBe("`foo`");
    expect(wrapCodeSpan("a`b")).toBe("``a`b``");
    expect(wrapCodeSpan("`code`")).toBe("`` `code` ``");
  });
});

describe("codeBlockFence", () => {
  it("is longer than any fence inside the body", () => {
    expect(codeBlockFence("plain")).toBe("```");
    expect(codeBlockFence("```js\nx\n```")).toBe("````");
    expect(codeBlockFence("inline ```not a fence```")).toBe("```");
  });
});

describe("indexOfOutsideCode", () => {
  it("skips markers inside code spans and escapes", () => {
    expect(indexOfOutsideCode("a `**` \\** **", "**", 0)).toBe(11);
    expect(indexOfOutsideCode("a `unclosed **", "**", 0)).toBe(12);
  });
});

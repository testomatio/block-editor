import { describe, expect, it } from "vitest";
import {
  applyInlineExclusion,
  buildFullMarkdown,
  stripInlineMarkdown,
  type FormattingMeta,
  type LinkMeta,
} from "./stepField";

describe("buildFullMarkdown formatting combinations", () => {
  const noLinks: LinkMeta[] = [];

  it("applies bold and italic to the same range", () => {
    const formatting: FormattingMeta[] = [
      { start: 0, end: 5, type: "bold" },
      { start: 0, end: 5, type: "italic" },
    ];
    expect(buildFullMarkdown("hello", noLinks, formatting)).toBe("_**hello**_");
  });

  it("preserves word-level bold when sentence-level bold is applied", () => {
    // User bolds "adipiscing", then bolds entire sentence.
    // The word-level bold should be merged into sentence-level bold,
    // not create nested **...**adipiscing**...** markers.
    const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";
    const formatting: FormattingMeta[] = [
      { start: 0, end: text.length, type: "bold" },
    ];
    expect(buildFullMarkdown(text, noLinks, formatting)).toBe(
      `**${text}**`,
    );
  });

  it("bold on word + italic on sentence produces correct markdown", () => {
    const text = "hello world";
    const formatting: FormattingMeta[] = [
      { start: 0, end: 5, type: "bold" },
      { start: 0, end: 11, type: "italic" },
    ];
    expect(buildFullMarkdown(text, noLinks, formatting)).toBe("_**hello** world_");
  });

  it("code formatting removes bold and italic", () => {
    // When code is applied, bold/italic should not appear
    const formatting: FormattingMeta[] = [
      { start: 0, end: 5, type: "code" },
    ];
    expect(buildFullMarkdown("hello", noLinks, formatting)).toBe("`hello`");
  });
});

describe("applyInlineExclusion mutual-exclusion rules", () => {
  it("applying code strips overlapping bold/italic", () => {
    const formatting: FormattingMeta[] = [
      { start: 0, end: 5, type: "bold" },
      { start: 0, end: 5, type: "italic" },
    ];
    const result = applyInlineExclusion(formatting, [], 0, 5, "code");
    expect(result.formatting).toEqual([]);
    expect(result.links).toEqual([]);
  });

  it("applying code strips overlapping links", () => {
    const links: LinkMeta[] = [{ start: 0, end: 5, url: "https://a" }];
    const result = applyInlineExclusion([], links, 0, 5, "code");
    expect(result.links).toEqual([]);
  });

  it("applying bold over a code range strips the code", () => {
    const formatting: FormattingMeta[] = [{ start: 0, end: 5, type: "code" }];
    const result = applyInlineExclusion(formatting, [], 0, 5, "bold");
    expect(result.formatting).toEqual([]);
  });

  it("applying italic over a linked range strips the link", () => {
    const links: LinkMeta[] = [{ start: 0, end: 5, url: "https://a" }];
    const result = applyInlineExclusion([], links, 0, 5, "italic");
    expect(result.links).toEqual([]);
  });

  it("applying bold preserves non-overlapping italic and non-overlapping links", () => {
    const formatting: FormattingMeta[] = [
      { start: 10, end: 20, type: "italic" },
    ];
    const links: LinkMeta[] = [{ start: 30, end: 40, url: "https://a" }];
    const result = applyInlineExclusion(formatting, links, 0, 5, "bold");
    expect(result.formatting).toEqual(formatting);
    expect(result.links).toEqual(links);
  });

  it("applying bold preserves overlapping italic (bold and italic coexist)", () => {
    const formatting: FormattingMeta[] = [
      { start: 0, end: 10, type: "italic" },
    ];
    const result = applyInlineExclusion(formatting, [], 0, 10, "bold");
    expect(result.formatting).toEqual(formatting);
  });

  it("applying italic drops overlapping italic (same-type replacement)", () => {
    const formatting: FormattingMeta[] = [
      { start: 0, end: 10, type: "italic" },
    ];
    const result = applyInlineExclusion(formatting, [], 2, 8, "italic");
    expect(result.formatting).toEqual([]);
  });
});

describe("step field code spans", () => {
  const URL = "{{baseURL}}/endpoint?query_param_one=value_one";

  it.each([
    ["`" + URL + "`"],
    ["``" + URL + "``"],
    ["```" + URL + "```"],
  ])("reads %s as one code range without italics", (markdown) => {
    expect(stripInlineMarkdown(markdown)).toEqual({
      plainText: URL,
      links: [],
      formatting: [{ start: 0, end: URL.length, type: "code" }],
    });
  });

  it("keeps an unmatched backtick run as text", () => {
    expect(stripInlineMarkdown("a ``b` c")).toEqual({
      plainText: "a ``b` c",
      links: [],
      formatting: [],
    });
  });

  it("keeps multi-line code blocks multi-line", () => {
    const result = stripInlineMarkdown(["```", "line 1", "line 2", "```"].join("\n"));
    expect(result.plainText).toBe("line 1\nline 2");
    expect(result.formatting).toEqual([{ start: 0, end: 13, type: "code" }]);
  });

  it("wraps code containing backticks in a longer delimiter", () => {
    const formatting: FormattingMeta[] = [{ start: 4, end: 7, type: "code" }];
    const markdown = buildFullMarkdown("run a`b now", [], formatting);
    expect(markdown).toBe("run ``a`b`` now");
    expect(stripInlineMarkdown(markdown)).toEqual({
      plainText: "run a`b now",
      links: [],
      formatting,
    });
  });
});

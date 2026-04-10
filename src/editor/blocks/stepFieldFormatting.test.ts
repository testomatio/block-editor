import { describe, expect, it } from "vitest";
import { buildFullMarkdown, type FormattingMeta, type LinkMeta } from "./stepField";

describe("buildFullMarkdown formatting combinations", () => {
  const noLinks: LinkMeta[] = [];

  it("applies bold and italic to the same range", () => {
    const formatting: FormattingMeta[] = [
      { start: 0, end: 5, type: "bold" },
      { start: 0, end: 5, type: "italic" },
    ];
    expect(buildFullMarkdown("hello", noLinks, formatting)).toBe("***hello***");
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
    expect(buildFullMarkdown(text, noLinks, formatting)).toBe("***hello** world*");
  });

  it("code formatting removes bold and italic", () => {
    // When code is applied, bold/italic should not appear
    const formatting: FormattingMeta[] = [
      { start: 0, end: 5, type: "code" },
    ];
    expect(buildFullMarkdown("hello", noLinks, formatting)).toBe("`hello`");
  });
});

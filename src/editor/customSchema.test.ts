import { describe, expect, it } from "vitest";
import { __markdownTestUtils } from "./customSchema";

describe("customSchema markdown helpers", () => {
  it("renders markdown images as <img> tags and round-trips back to markdown", () => {
    const markdown = "![](/attachments/example.png)";
    const html = __markdownTestUtils.markdownToHtml(markdown);

    expect(html).toContain('<img src="/attachments/example.png" alt="" class="bn-inline-image" contenteditable="false" draggable="false" />');

    const roundTrip = __markdownTestUtils.htmlToMarkdown(html);
    expect(roundTrip).toBe(markdown);
  });

  it("handles images mixed with surrounding text", () => {
    const markdown = [
      "Success screenshot:",
      "![](/attachments/success.png)",
      "Please archive it.",
    ].join("\n");

    const html = __markdownTestUtils.markdownToHtml(markdown);
    expect(html).toContain('<img src="/attachments/success.png" alt="" class="bn-inline-image" contenteditable="false" draggable="false" />');

    const roundTrip = __markdownTestUtils.htmlToMarkdown(html);
    expect(roundTrip).toBe("Success screenshot:\n![](/attachments/success.png)\nPlease archive it.");
  });

  it("renders expected-result style markdown with an image", () => {
    const markdown = [
      "Login should look like this",
      "![](/login.png)",
    ].join("\n");

    const html = __markdownTestUtils.markdownToHtml(markdown);
    expect(html).toContain('<img src="/login.png" alt="" class="bn-inline-image" contenteditable="false" draggable="false" />');
    expect(__markdownTestUtils.htmlToMarkdown(html)).toBe(markdown);
  });

  it("keeps inline images when mixed inside a single line of markdown text", () => {
    const markdown = "* asdsadsad aaaaa  asd ![](https://placehold.co/600x400?text=Uploaded+1763329962213)";
    const html = __markdownTestUtils.markdownToHtml(markdown);

    expect(html).toContain('<img src="https://placehold.co/600x400?text=Uploaded+1763329962213" alt="" class="bn-inline-image" contenteditable="false" draggable="false" />');
    expect(__markdownTestUtils.htmlToMarkdown(html)).toBe(markdown);
  });
});

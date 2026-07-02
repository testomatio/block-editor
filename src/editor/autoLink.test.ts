import { describe, expect, it } from "vitest";
import { detectLinks } from "./autoLink";

describe("detectLinks", () => {
  it("detects a single https URL", () => {
    expect(detectLinks("https://example.com")).toEqual([
      { start: 0, end: 19, href: "https://example.com" },
    ]);
  });

  it("detects an http URL", () => {
    expect(detectLinks("http://example.com")).toEqual([
      { start: 0, end: 18, href: "http://example.com" },
    ]);
  });

  it("detects a URL embedded in prose", () => {
    // "See https://example.com now" — the URL starts at index 4.
    expect(detectLinks("See https://example.com now")).toEqual([
      { start: 4, end: 23, href: "https://example.com" },
    ]);
  });

  it("detects multiple URLs in one string", () => {
    const matches = detectLinks("a https://a.com b http://b.com");
    expect(matches).toEqual([
      { start: 2, end: 15, href: "https://a.com" },
      { start: 18, end: 30, href: "http://b.com" },
    ]);
  });

  it("keeps a full URL with path, query and fragment", () => {
    const url = "https://example.com/path/to?q=1&x=2#frag";
    expect(detectLinks(url)).toEqual([{ start: 0, end: url.length, href: url }]);
  });

  it("trims a trailing sentence period", () => {
    expect(detectLinks("Read https://example.com.")).toEqual([
      { start: 5, end: 24, href: "https://example.com" },
    ]);
  });

  it("trims trailing punctuation like comma and question mark", () => {
    expect(detectLinks("go to https://a.com, ok?")).toEqual([
      { start: 6, end: 19, href: "https://a.com" },
    ]);
    expect(detectLinks("is it https://a.com?")).toEqual([
      { start: 6, end: 19, href: "https://a.com" },
    ]);
  });

  it("excludes an unbalanced closing paren wrapping the URL", () => {
    expect(detectLinks("(see https://example.com)")).toEqual([
      { start: 5, end: 24, href: "https://example.com" },
    ]);
  });

  it("keeps balanced parentheses that belong to the URL", () => {
    const url = "https://en.wikipedia.org/wiki/Foo_(bar)";
    expect(detectLinks(url)).toEqual([{ start: 0, end: url.length, href: url }]);
  });

  it("keeps a balanced paren but trims the trailing sentence period", () => {
    const text = "https://en.wikipedia.org/wiki/Foo_(bar).";
    expect(detectLinks(text)).toEqual([
      {
        start: 0,
        end: text.length - 1,
        href: "https://en.wikipedia.org/wiki/Foo_(bar)",
      },
    ]);
  });

  it("stops the URL at whitespace", () => {
    expect(detectLinks("https://a.com and more")).toEqual([
      { start: 0, end: 13, href: "https://a.com" },
    ]);
  });

  it("does not match bare domains without a scheme", () => {
    expect(detectLinks("visit example.com or www.example.com")).toEqual([]);
  });

  it("does not match ftp or other schemes", () => {
    expect(detectLinks("ftp://files.example.com")).toEqual([]);
  });

  it("does not match a scheme with no host", () => {
    expect(detectLinks("https://")).toEqual([]);
  });

  it("returns an empty array for text without URLs", () => {
    expect(detectLinks("A plain sentence with no links")).toEqual([]);
  });

  it("is case-insensitive on the scheme", () => {
    expect(detectLinks("HTTPS://Example.com")).toEqual([
      { start: 0, end: 19, href: "HTTPS://Example.com" },
    ]);
  });

  it("does not keep stale regex state across calls", () => {
    // Guards against a shared lastIndex leaking between invocations.
    expect(detectLinks("https://one.com")).toEqual([
      { start: 0, end: 15, href: "https://one.com" },
    ]);
    expect(detectLinks("https://two.com")).toEqual([
      { start: 0, end: 15, href: "https://two.com" },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { isSuiteDocument, markExampleTables } from "./exampleTableHighlight";

describe("isSuiteDocument", () => {
  it("is true only when the first block is a suite testMeta", () => {
    expect(isSuiteDocument("testMeta", "suite")).toBe(true);
  });

  it("is false for a document opening with a test (not a suite)", () => {
    expect(isSuiteDocument("testMeta", "test")).toBe(false);
  });

  it("is false when the first block is not a testMeta", () => {
    expect(isSuiteDocument("heading", undefined)).toBe(false);
    expect(isSuiteDocument("paragraph", "suite")).toBe(false);
  });

  it("is false for an empty document", () => {
    expect(isSuiteDocument(undefined, undefined)).toBe(false);
  });
});

describe("markExampleTables", () => {
  it("flags a table that follows an example marker", () => {
    expect(markExampleTables(["exampleMarker", "paragraph", "table"])).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("stops the region at the next test/suite comment", () => {
    // First table is in the example region; the testMeta closes it, so the
    // second table (belonging to the next test) is not flagged.
    expect(
      markExampleTables(["exampleMarker", "table", "testMeta", "table"]),
    ).toEqual([false, true, false, false]);
  });

  it("does not flag tables without a preceding example marker", () => {
    expect(markExampleTables(["table"])).toEqual([false]);
    expect(markExampleTables(["testMeta", "table"])).toEqual([false, false]);
  });

  it("keeps the region open across headings and other blocks", () => {
    expect(
      markExampleTables(["exampleMarker", "heading", "paragraph", "table"]),
    ).toEqual([false, false, false, true]);
  });

  it("flags every table in the region until the next test", () => {
    expect(
      markExampleTables(["exampleMarker", "table", "table", "testMeta", "table"]),
    ).toEqual([false, true, true, false, false]);
  });

  it("reopens the region when a new example marker appears", () => {
    expect(
      markExampleTables(["exampleMarker", "table", "testMeta", "exampleMarker", "table"]),
    ).toEqual([false, true, false, false, true]);
  });

  it("returns an empty array for no blocks", () => {
    expect(markExampleTables([])).toEqual([]);
  });
});

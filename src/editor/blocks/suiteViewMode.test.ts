import { describe, it, expect } from "vitest";
import { isSuiteBlockDocument } from "./step";

// Steps are locked to the compact view in a *suite* document — one whose first
// block is the `<!-- suite ... -->` comment. Anything else keeps the shared
// (user-chosen) view mode.

const meta = (id: string, metaKind: string) => ({ id, type: "testMeta", props: { metaKind } });
const para = (id: string, text: string) => ({
  id,
  type: "paragraph",
  content: [{ type: "text", text }],
});
const step = (id: string) => ({ id, type: "testStep", props: {} });

describe("isSuiteBlockDocument", () => {
  it("is true when the document opens with a suite comment", () => {
    expect(isSuiteBlockDocument([meta("m", "suite"), step("a")])).toBe(true);
  });

  it("is false for a document opening with a test comment", () => {
    expect(isSuiteBlockDocument([meta("m", "test"), step("a")])).toBe(false);
  });

  it("is false when a suite comment is present but not first", () => {
    expect(isSuiteBlockDocument([para("p", "notes"), meta("m", "suite"), step("a")])).toBe(false);
  });

  it("is false for a document that opens with any other block", () => {
    expect(isSuiteBlockDocument([step("a")])).toBe(false);
  });

  it("is false for an empty document", () => {
    expect(isSuiteBlockDocument([])).toBe(false);
  });
});

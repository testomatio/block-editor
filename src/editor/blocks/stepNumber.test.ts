import { describe, it, expect } from "vitest";
import { computeStepNumber } from "./step";

// Numbering correctness: a step's number is its position within its group.
// Blank lines between steps don't break the run; any other block resets it.

const heading = (id: string) => ({ id, type: "heading", content: [{ type: "text", text: "Steps" }] });
const step = (id: string) => ({ id, type: "testStep", props: {} });
const emptyPara = (id: string) => ({ id, type: "paragraph", content: [] });
const para = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }] });

describe("computeStepNumber", () => {
  it("numbers consecutive steps within a group", () => {
    const doc = [heading("h"), step("a"), step("b"), step("c")];
    expect(computeStepNumber(doc, "a")).toBe(1);
    expect(computeStepNumber(doc, "b")).toBe(2);
    expect(computeStepNumber(doc, "c")).toBe(3);
  });

  it("keeps counting across blank lines but resets after other content", () => {
    const doc = [
      heading("h"),
      step("a"), // 1
      emptyPara("e1"), // blank line — does not break the run
      step("b"), // 2
      para("note", "some note"), // non-step content resets the run
      step("c"), // 1
      step("d"), // 2
    ];
    expect(computeStepNumber(doc, "a")).toBe(1);
    expect(computeStepNumber(doc, "b")).toBe(2);
    expect(computeStepNumber(doc, "c")).toBe(1);
    expect(computeStepNumber(doc, "d")).toBe(2);
  });

  it("falls back to 1 for an unknown block", () => {
    expect(computeStepNumber([step("a")], "missing")).toBe(1);
  });
});

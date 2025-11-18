import { describe, expect, it } from "vitest";
import { customSchema } from "../customSchema";

describe("custom block specs", () => {
  it("registers the step block", () => {
    const step = customSchema.blockSpecs.testStep;
    expect(step).toBeDefined();
    expect((step as any).config?.type ?? (step as any).type).toBe("testStep");
    expect((step as any).config?.propSchema?.stepTitle?.default).toBe("");
    expect((step as any).config?.propSchema?.stepData?.default).toBe("");
    expect((step as any).config?.propSchema?.expectedResult?.default).toBe("");
  });

  it("registers the snippet block", () => {
    const snippet = customSchema.blockSpecs.snippet;
    expect(snippet).toBeDefined();
    expect((snippet as any).config?.type ?? (snippet as any).type).toBe("snippet");
    expect((snippet as any).config?.propSchema?.snippetId?.default).toBe("");
    expect((snippet as any).config?.propSchema?.snippetTitle?.default).toBe("");
    expect((snippet as any).config?.propSchema?.snippetData?.default).toBe("");
  });
});

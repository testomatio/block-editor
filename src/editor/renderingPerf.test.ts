import { describe, it, expect } from "vitest";
import { markdownToBlocks } from "./customMarkdownConverter";

// Coarse regression guard for parse cost. Parsing was never the bottleneck
// (~5-15ms for a 1000-block document) — rendering was — but a future change
// could accidentally make the parser quadratic. These use best-of-N timing
// (noise only ever adds time, so the minimum approximates true compute cost)
// with generous bounds, so they only fail on a real algorithmic regression.

function generateMarkdown(testCases: number): string {
  const parts: string[] = ["<!-- suite -->", "# Generated Suite", ""];
  for (let t = 0; t < testCases; t++) {
    parts.push("<!-- test\nid: @T" + t + "\n-->");
    parts.push("# Test case number " + t);
    parts.push("## Steps", "");
    for (let s = 0; s < 6; s++) {
      parts.push("* Perform action " + s + " in test " + t);
      parts.push("  *Expected:* Result " + s + " is observed in test " + t);
    }
    parts.push("");
  }
  return parts.join("\n");
}

function bestOfMs(runs: number, fn: () => void): number {
  // warm up the JIT first
  for (let i = 0; i < 3; i++) fn();
  let min = Infinity;
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    min = Math.min(min, performance.now() - t0);
  }
  return min;
}

describe("rendering perf — markdown parsing stays fast", () => {
  it("parses a large (1000+ block) document well within budget", () => {
    const md = generateMarkdown(150);
    const blocks = markdownToBlocks(md);
    expect(blocks.length).toBeGreaterThan(500);

    const ms = bestOfMs(8, () => markdownToBlocks(md));
    // ~20-50x headroom over the real ~5-15ms cost.
    expect(ms).toBeLessThan(250);
  });

  it("scales sub-quadratically with document size", () => {
    const small = generateMarkdown(100);
    const large = generateMarkdown(400); // 4x the content

    const tSmall = bestOfMs(8, () => markdownToBlocks(small));
    const tLarge = bestOfMs(8, () => markdownToBlocks(large));

    // 4x the input: linear parsing ≈ 4x time, quadratic ≈ 16x. Allow a generous
    // 8x (plus a small cushion for tiny-time measurement noise).
    expect(tLarge).toBeLessThan(tSmall * 8 + 5);
  });
});

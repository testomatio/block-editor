import { afterEach, describe, expect, it } from "vitest";
import { getMetaFieldSuggestions, setMetaFieldSuggestions } from "./testMetaFields";

// `configured` is module-level state — reset it so one test never leaks into the next.
afterEach(() => setMetaFieldSuggestions(null));

const keys = (kind: "test" | "suite") => getMetaFieldSuggestions(kind).map((s) => s.key);

describe("getMetaFieldSuggestions", () => {
  it("does not suggest creator or shared for tests", () => {
    expect(keys("test")).not.toContain("creator");
    expect(keys("test")).not.toContain("shared");
  });

  it("suggests issues last for tests", () => {
    const testKeys = keys("test");
    expect(testKeys).toContain("issues");
    expect(testKeys[testKeys.length - 1]).toBe("issues");
  });

  it("keeps the classic test fields", () => {
    expect(keys("test")).toEqual([
      "priority",
      "type",
      "tags",
      "labels",
      "assignee",
      "issues",
    ]);
  });

  it("leaves the suite suggestions unchanged", () => {
    expect(keys("suite")).toEqual(["emoji", "tags", "labels", "assignee"]);
  });

  it("lets the host app override the defaults", () => {
    setMetaFieldSuggestions([{ key: "severity" }]);
    expect(keys("test")).toEqual(["severity"]);
    expect(keys("suite")).toEqual(["severity"]);

    setMetaFieldSuggestions({ test: [{ key: "component" }] });
    expect(keys("test")).toEqual(["component"]);
    // No `suite` list configured — that kind falls back to its defaults.
    expect(keys("suite")).toEqual(["emoji", "tags", "labels", "assignee"]);

    setMetaFieldSuggestions(null);
    expect(keys("test")).toContain("issues");
  });
});

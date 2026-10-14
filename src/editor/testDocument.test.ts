import { describe, expect, it } from "vitest";
import { parseTestDocument, metaFieldValue } from "./testDocument";
import { splitTags } from "./tags";

const SUITE = [
  "<!-- suite",
  "id: @S614d9bf9",
  "emoji: 🚀",
  "-->",
  "# opencode test @sprint_01",
  "",
  "Suite notes.",
  "",
  "<!-- test",
  "id: @T9b120377",
  "type: manual",
  "priority: normal",
  "tags: sprint_01",
  "-->",
  "## asdmalskdmn",
  "",
  "### Requirements",
  "",
  "### Steps",
  "",
  "* curl 'https://stable\\.testomat\\.io/api/runs?page=1' \\",
  "  -H 'accept: application/json'",
  "  *Expected result*: JSON comes back",
  "* Log in",
  "",
  "<!-- test id: @T00000002 -->",
  "## Second @smoke",
  "",
  "```md",
  "## Not a heading",
  "<!-- test",
  "```",
].join("\n");

describe("parseTestDocument", () => {
  const sections = parseTestDocument(SUITE);

  it("cuts the file at each test and suite comment", () => {
    expect(sections.map((s) => s.meta?.kind)).toEqual(["suite", "test", "test"]);
    expect(sections.map((s) => [s.start, s.bodyStart, s.end])).toEqual([
      [0, 4, 8],
      [8, 14, 25],
      [25, 26, 32],
    ]);
  });

  it("reads meta fields, one-line comments included", () => {
    expect(metaFieldValue(sections[0].meta, "id")).toBe("@S614d9bf9");
    expect(metaFieldValue(sections[0].meta, "Emoji")).toBe("🚀");
    expect(metaFieldValue(sections[1].meta, "type")).toBe("manual");
    expect(sections[2].meta).toEqual({
      kind: "test",
      fields: [{ key: "id", value: "@T00000002" }],
      inline: true,
    });
  });

  it("takes the first # or ## heading as the title", () => {
    expect(sections[0].heading).toEqual({ line: 4, level: 1, text: "opencode test @sprint_01" });
    expect(sections[1].heading?.text).toBe("asdmalskdmn");
    expect(sections[2].heading?.text).toBe("Second @smoke");
  });

  it("ignores headings and comments inside code fences", () => {
    expect(sections).toHaveLength(3);
    expect(sections[2].steps).toEqual([]);
  });

  it("reads steps under the Steps heading like the editor does", () => {
    expect(sections[1].stepsHeading?.line).toBe(18);
    expect(sections[1].steps.map(({ title, data, expected }) => ({ title, data, expected }))).toEqual([
      {
        title: "curl 'https://stable.testomat.io/api/runs?page=1' \\",
        data: "-H 'accept: application/json'",
        expected: "JSON comes back",
      },
      { title: "Log in", data: "", expected: "" },
    ]);
  });

  it("trims the blank line a step swallows before the next comment", () => {
    const [test] = parseTestDocument("<!-- test -->\n## A\n### Steps\n* Go\n  *Expected*: Done\n\n<!-- test -->\n## B");
    expect(test.steps[0].expected).toBe("Done");
    expect(sections[1].steps[0].start).toBe(20);
  });

  it("keeps text above the first comment as its own section", () => {
    const [intro, test] = parseTestDocument("Intro.\n\n<!-- test\nid: @T1\n-->\n# A");
    expect(intro.meta).toBeNull();
    expect([intro.start, intro.end]).toEqual([0, 2]);
    expect(test.heading?.text).toBe("A");
  });

  it("gives a file without comments one section", () => {
    expect(parseTestDocument("")).toEqual([]);
    expect(parseTestDocument("# Title")).toHaveLength(1);
  });
});

describe("splitTags", () => {
  it("pulls @tags out of a title", () => {
    expect(splitTags("Login works @smoke @severity:high")).toEqual({
      title: "Login works",
      tags: ["@smoke", "@severity:high"],
    });
  });

  it("leaves emails alone", () => {
    expect(splitTags("Mail a@b.com")).toEqual({ title: "Mail a@b.com", tags: [] });
  });

  it("keeps a title made only of tags", () => {
    expect(splitTags("@smoke")).toEqual({ title: "@smoke", tags: ["@smoke"] });
  });
});

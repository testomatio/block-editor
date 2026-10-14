import { scanMarkdownBlocks, type LocatedBlock } from "./customMarkdownConverter";
import { isStepsHeading } from "./stepsHeading";

export type TestMetaKind = "test" | "suite";

export type TestMetaField = { key: string; value: string };

export type TestDocumentMeta = {
  kind: TestMetaKind;
  fields: TestMetaField[];
  inline: boolean;
};

export type TestDocumentStep = {
  title: string;
  data: string;
  expected: string;
  /** Set when the step is a snippet. */
  snippetId?: string;
  start: number;
  end: number;
};

export type TestDocumentHeading = {
  line: number;
  level: number;
  /** The heading as written, `@tags` included. */
  text: string;
};

/**
 * A `*.test.md` file cut at each `<!-- test -->` / `<!-- suite -->` comment.
 * Line numbers are 0-based; `end` is exclusive.
 */
export type TestDocumentSection = {
  /** Null for text above the first comment. */
  meta: TestDocumentMeta | null;
  start: number;
  /** First line after the comment. */
  bodyStart: number;
  end: number;
  /** The first `#` or `##` heading: the test or suite title. */
  heading: TestDocumentHeading | null;
  /** The `Steps` heading the steps sit under. */
  stepsHeading: TestDocumentHeading | null;
  steps: TestDocumentStep[];
};

/** Reads a `*.test.md` file with the same parser the editor uses. */
export function parseTestDocument(markdown: string): TestDocumentSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: TestDocumentSection[] = [];
  let current = openSection(null, 0, 0);

  for (const located of scanMarkdownBlocks(markdown)) {
    const { block } = located;
    if (block.type === "testMeta") {
      close(current, located.start);
      current = openSection(readMeta(block.props), located.start, located.end);
      continue;
    }
    if (block.type === "heading") {
      const heading = readHeading(lines, located.start);
      if (!heading) continue;
      if (!current.heading && heading.level <= 2) current.heading = heading;
      if (!current.stepsHeading && isStepsHeadingText(heading.text)) current.stepsHeading = heading;
      continue;
    }
    const step = readStep(located);
    if (step) current.steps.push(step);
  }
  close(current, lines.length);
  return sections;

  function close(section: TestDocumentSection, end: number) {
    section.end = end;
    if (section.meta || hasText(lines, section.start, end)) sections.push(section);
  }
}

/** The value of a meta field, matched by key without case. */
export function metaFieldValue(
  meta: TestDocumentMeta | null | undefined,
  key: string,
): string | undefined {
  const wanted = key.toLowerCase();
  return meta?.fields.find((field) => field.key.trim().toLowerCase() === wanted)?.value;
}

function openSection(meta: TestDocumentMeta | null, start: number, bodyStart: number): TestDocumentSection {
  return { meta, start, bodyStart, end: bodyStart, heading: null, stepsHeading: null, steps: [] };
}

function readMeta(props: unknown): TestDocumentMeta {
  const { metaKind, metaFields, metaInline } = (props ?? {}) as Record<string, unknown>;
  const kind: TestMetaKind = metaKind === "suite" ? "suite" : "test";
  return {
    kind,
    fields: JSON.parse(typeof metaFields === "string" ? metaFields : "[]") as TestMetaField[],
    inline: metaInline === true,
  };
}

function readHeading(lines: string[], line: number): TestDocumentHeading | null {
  const match = lines[line]?.trim().match(/^(#+)\s+(.*)$/);
  if (!match) return null;
  return { line, level: match[1].length, text: match[2].trim() };
}

function isStepsHeadingText(text: string) {
  return isStepsHeading(text.trim().toLowerCase().replace(/[:\-–—]$/, ""));
}

function readStep(located: LocatedBlock): TestDocumentStep | null {
  const { block, start, end } = located;
  const props = (block.props ?? {}) as Record<string, string>;
  if (block.type === "testStep") {
    return {
      title: (props.stepTitle ?? "").trim(),
      data: (props.stepData ?? "").trim(),
      expected: (props.expectedResult ?? "").trim(),
      start,
      end,
    };
  }
  if (block.type === "snippet") {
    return {
      title: (props.snippetTitle ?? "").trim(),
      data: (props.snippetData ?? "").trim(),
      expected: (props.snippetExpectedResult ?? "").trim(),
      snippetId: props.snippetId ?? "",
      start,
      end,
    };
  }
  return null;
}

function hasText(lines: string[], start: number, end: number) {
  for (let i = start; i < end; i++) {
    if (lines[i].trim()) return true;
  }
  return false;
}

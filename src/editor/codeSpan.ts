// CommonMark code span helpers (https://spec.commonmark.org/0.31.2/#code-spans),
// shared by the Markdown ↔ blocks converter and StepField so both read
// backticks the same way a standard Markdown renderer does:
//
// - a span opens with a run of N backticks and closes with the next run of
//   exactly N backticks, so ``a`b`` is the code "a`b";
// - a run with no matching closer is literal text;
// - backslash escapes do not work inside code (`a\.b` keeps its backslash);
// - line endings become spaces, and one space is stripped from each side when
//   both sides have one and the content is not all spaces.

export type CodeSpanScan =
  | { kind: "span"; content: string; end: number }
  | { kind: "literal"; end: number };

export function backtickRunLength(text: string, index: number): number {
  let length = 0;
  while (text[index + length] === "`") {
    length += 1;
  }
  return length;
}

// Finds the next run of exactly `length` backticks at or after `from`.
export function findBacktickRun(text: string, from: number, length: number): number {
  let j = from;
  while (j < text.length) {
    if (text[j] !== "`") {
      j += 1;
      continue;
    }
    const run = backtickRunLength(text, j);
    if (run === length) {
      return j;
    }
    j += run;
  }
  return -1;
}

function normalizeCodeSpanContent(raw: string): string {
  const content = raw.replace(/\r?\n/g, " ");
  if (
    content.length >= 2 &&
    content.startsWith(" ") &&
    content.endsWith(" ") &&
    content.trim().length > 0
  ) {
    return content.slice(1, -1);
  }
  return content;
}

// Reads the backtick run at `index`. Returns the code span it opens, or — when
// no closing run exists — a literal run the caller should keep as plain text.
// Returns null when `index` is not a backtick.
export function scanCodeSpan(text: string, index: number): CodeSpanScan | null {
  const length = backtickRunLength(text, index);
  if (length === 0) {
    return null;
  }
  const contentStart = index + length;
  const close = findBacktickRun(text, contentStart, length);
  if (close === -1) {
    return { kind: "literal", end: contentStart };
  }
  return {
    kind: "span",
    content: normalizeCodeSpanContent(text.slice(contentStart, close)),
    end: close + length,
  };
}

function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const match of text.match(/`+/g) ?? []) {
    longest = Math.max(longest, match.length);
  }
  return longest;
}

// Wraps `content` in a code span that reads back as exactly `content`: the
// delimiter is longer than any backtick run inside, and a padding space is
// added when the content touches a backtick or is itself space-padded (the
// reader strips one space from each side).
export function wrapCodeSpan(content: string): string {
  const fence = "`".repeat(longestBacktickRun(content) + 1);
  const needsPadding =
    content.startsWith("`") ||
    content.endsWith("`") ||
    (content.length >= 2 &&
      content.startsWith(" ") &&
      content.endsWith(" ") &&
      content.trim().length > 0);
  const pad = needsPadding ? " " : "";
  return `${fence}${pad}${content}${pad}${fence}`;
}

// Fence for a fenced code block whose body may itself contain fence lines:
// at least three backticks and longer than any run that starts a body line.
export function codeBlockFence(body: string): string {
  let longest = 0;
  for (const match of body.matchAll(/^[ \t]*(`{3,})/gm)) {
    longest = Math.max(longest, match[1].length);
  }
  return "`".repeat(Math.max(3, longest + 1));
}

// `text.indexOf(marker, from)` that skips code spans and backslash escapes, so
// an emphasis or link closer inside `code` is never matched — code spans bind
// tighter than every other inline construct.
export function indexOfOutsideCode(text: string, marker: string, from: number): number {
  let j = from;
  while (j < text.length) {
    if (text[j] === "\\") {
      j += 2;
      continue;
    }
    if (text[j] === "`") {
      j = scanCodeSpan(text, j)!.end;
      continue;
    }
    if (text.startsWith(marker, j)) {
      return j;
    }
    j += 1;
  }
  return -1;
}

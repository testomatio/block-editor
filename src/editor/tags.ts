/**
 * Tags are tokens that start with `@` and may contain alphanumerics plus a few
 * symbols (`= - _ ( ) . : &`), e.g. `@smoke`, `@severity:high`, `@T1234abcd`.
 *
 * This is a faithful JS port of the backend (Ruby) tag regexes:
 *   TAG_PREFIX_REGEXP         = /(?:^|[ \t])/
 *   TAG_ALLOWED_SYMBOLS_REGEXP = /[\w\d\=\-\_\(\)\.\:\&]*[\w\d\)]/
 *   TAGS_DETECT_REGEXP        = /(?:^|[ \t])(\@<allowed>)/
 *
 * `\w` already covers `[0-9_]`, so the symbol class is kept minimal while
 * staying faithful to the allowed characters. A tag must be preceded by the
 * start of the string or whitespace — so email-like text (`user@example.com`)
 * is correctly ignored.
 */
const TAG_ALLOWED_SYMBOLS = String.raw`[\w=\-_().:&]*[\w)]`;

/** Matches a tag (capture group 1) preceded by start-of-string or whitespace. */
export const TAGS_DETECT_REGEXP = new RegExp(
  String.raw`(?:^|[ \t])(@${TAG_ALLOWED_SYMBOLS})`,
  "g",
);

export interface TagMatch {
  /** Offset of the `@` within the scanned string (the leading space is excluded). */
  start: number;
  /** Offset just past the last character of the tag. */
  end: number;
  /** The matched tag text, including the leading `@`. */
  tag: string;
}

/**
 * Find all `@tag` tokens inside a plain string and return their offsets.
 * Pure and DOM-free so it can be unit-tested directly.
 */
export function detectTags(text: string): TagMatch[] {
  const matches: TagMatch[] = [];
  // Use a fresh regex each call so the shared `lastIndex` state never leaks
  // between invocations.
  const regexp = new RegExp(TAGS_DETECT_REGEXP.source, "g");
  let match: RegExpExecArray | null;
  while ((match = regexp.exec(text)) !== null) {
    const tag = match[1];
    // The match may include a leading space/tab consumed by the prefix; the tag
    // itself starts that many characters into the overall match.
    const start = match.index + (match[0].length - tag.length);
    matches.push({ start, end: start + tag.length, tag });
    // Defensive guard against a zero-length match looping forever (a tag always
    // starts with `@`, so this should never trigger).
    if (regexp.lastIndex === match.index) {
      regexp.lastIndex++;
    }
  }
  return matches;
}

/**
 * A heading split into its plain title and its `@tags`, e.g.
 * `Login works @smoke` → `{ title: "Login works", tags: ["@smoke"] }`.
 */
export function splitTags(text: string): { title: string; tags: string[] } {
  const matches = detectTags(text);
  let title = "";
  let last = 0;
  for (const match of matches) {
    title += text.slice(last, match.start);
    last = match.end;
  }
  title = (title + text.slice(last)).replace(/\s+/g, " ").trim();
  return { title: title || text, tags: matches.map((match) => match.tag) };
}

import { BlockNoteExtension } from "@blocknote/core";
import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

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

const tagBadgePluginKey = new PluginKey<DecorationSet>("testomatioTagBadge");

/**
 * Build inline decorations for every `@tag` found inside heading blocks. Tags
 * are only *painted* — the underlying text is untouched, so markdown
 * serialization round-trips unchanged.
 */
function buildHeadingTagDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "heading") {
      return undefined;
    }

    // Walk the heading's inline children so positions stay correct even when it
    // contains links or inline images alongside text.
    node.forEach((child, offset) => {
      if (!child.isText || !child.text) {
        return;
      }
      // `pos + 1` steps inside the heading content node; `offset` is the child's
      // position relative to the node's content.
      const base = pos + 1 + offset;
      for (const { start, end } of detectTags(child.text)) {
        decorations.push(
          Decoration.inline(base + start, base + end, {
            class: "bn-tag-badge",
          }),
        );
      }
    });

    // Headings only hold inline content; no need to descend further.
    return false;
  });

  return DecorationSet.create(doc, decorations);
}

function tagBadgePlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: tagBadgePluginKey,
    state: {
      init: (_config, state) => buildHeadingTagDecorations(state.doc),
      apply: (tr, value) =>
        tr.docChanged ? buildHeadingTagDecorations(tr.doc) : value,
    },
    props: {
      decorations(state) {
        return tagBadgePluginKey.getState(state);
      },
    },
  });
}

/**
 * BlockNote extension that renders `@tags` inside headings as badges.
 *
 * Editor extensions are supplied at editor-creation time and cannot be carried
 * by the schema, so consumers must add this to their `useCreateBlockNote` call:
 *
 * ```ts
 * useCreateBlockNote({
 *   schema: customSchema,
 *   extensions: [tagBadgeExtension()],
 * });
 * ```
 */
export class TagBadgeExtension extends BlockNoteExtension {
  static key() {
    return "tagBadge";
  }

  constructor() {
    super();
    this.addProsemirrorPlugin(tagBadgePlugin());
  }
}

/** Factory for the `extensions` option of `useCreateBlockNote`. */
export const tagBadgeExtension = () => new TagBadgeExtension();

import { describe, expect, it } from "vitest";
import { Schema } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { findMentionAtCaret } from "./mentionReopen";
import type { MentionSource } from "./mentionAutocomplete";

/** Minimal schema: a doc of paragraphs plus a code block, matching what the
 *  detector cares about (block boundaries and `spec.code`). */
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "text*", group: "block" },
    code_block: { content: "text*", group: "block", code: true },
    text: {},
  },
});

const sources: MentionSource[] = [
  { prefix: "T", label: "Tests", search: async () => [] },
  { prefix: "", label: "Users", items: [{ id: "1", label: "Yana Baranova" }] },
];

/** State whose caret sits at `caret` (0-based offset into the block's text). */
function stateAt(text: string, caret: number, nodeType = "paragraph") {
  const node = schema.nodes[nodeType].create(null, text ? schema.text(text) : null);
  const doc = schema.nodes.doc.create(null, node);
  const state = EditorState.create({ doc });
  // +1 for entering the block node.
  return state.apply(
    state.tr.setSelection(TextSelection.create(doc, caret + 1)),
  );
}

describe("findMentionAtCaret", () => {
  it("finds the `@` of the token the caret sits in", () => {
    const state = stateAt("ping @yan", 9);
    expect(findMentionAtCaret(state, sources)).toEqual({ atPos: 6, caret: 10 });
  });

  it("maps document positions relative to the containing block", () => {
    const state = stateAt("@yan", 4);
    // The `@` is the first character of the block, i.e. position 1.
    expect(findMentionAtCaret(state, sources)).toEqual({ atPos: 1, caret: 5 });
  });

  it("resolves prefixed sources like `@T`", () => {
    const state = stateAt("see @T123", 9);
    expect(findMentionAtCaret(state, sources)).toEqual({ atPos: 5, caret: 10 });
  });

  it("returns null once the caret is past the token", () => {
    expect(findMentionAtCaret(stateAt("@yan done", 9), sources)).toBeNull();
  });

  it("returns null with no `@` before the caret", () => {
    expect(findMentionAtCaret(stateAt("hello", 5), sources)).toBeNull();
  });

  it("returns null for an `@` that does not start a word (emails)", () => {
    expect(findMentionAtCaret(stateAt("a@b.com", 7), sources)).toBeNull();
  });

  it("returns null inside a code block", () => {
    expect(findMentionAtCaret(stateAt("@yan", 4, "code_block"), sources)).toBeNull();
  });

  it("returns null for a non-empty selection", () => {
    const base = stateAt("@yan", 4);
    const selected = base.apply(
      base.tr.setSelection(TextSelection.create(base.doc, 1, 5)),
    );
    expect(findMentionAtCaret(selected, sources)).toBeNull();
  });

  it("returns null when no source claims the token", () => {
    expect(findMentionAtCaret(stateAt("@yan", 4), [{ prefix: "T" }])).toBeNull();
  });
});

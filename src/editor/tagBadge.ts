import { BlockNoteExtension } from "@blocknote/core";
import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { detectTags } from "./tags";

export { TAGS_DETECT_REGEXP, detectTags, splitTags } from "./tags";
export type { TagMatch } from "./tags";

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

import { BlockNoteExtension } from "@blocknote/core";
import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

/**
 * An "example table" is a data table that belongs to a testomat.io `<!-- example -->`
 * marker: it sits between that marker and the start of the next test — i.e. the next
 * `testMeta` block (`<!-- test ... -->` / `<!-- suite ... -->`) — or the end of the
 * document. Such tables are painted with a gray cell background so they read as the
 * marker's data table.
 *
 * Given the block content-type names in document order, returns a boolean[] where
 * entry `i` is `true` iff a `"table"` at index `i` falls inside an example region.
 * `exampleMarker` opens a region; `testMeta` closes it; everything else (headings,
 * paragraphs, …) leaves the region unchanged.
 *
 * Pure and DOM-free so it can be unit-tested directly.
 */
export function markExampleTables(types: readonly string[]): boolean[] {
  const flags: boolean[] = [];
  let active = false;
  for (const name of types) {
    if (name === "exampleMarker") {
      active = true;
      flags.push(false);
    } else if (name === "testMeta") {
      active = false;
      flags.push(false);
    } else {
      flags.push(name === "table" && active);
    }
  }
  return flags;
}

/**
 * Example tables only occur in a *suite* document — one that opens with a
 * `<!-- suite ... -->` comment (a `testMeta` block whose `metaKind` is `"suite"`).
 * Gating on the first block lets the plugin skip the whole scan for any other
 * document (a lone test, plain notes, …) instead of walking it on every change.
 *
 * Pure so it can be unit-tested directly.
 */
export function isSuiteDocument(
  firstBlockType: string | undefined,
  firstBlockMetaKind: string | undefined,
): boolean {
  return firstBlockType === "testMeta" && firstBlockMetaKind === "suite";
}

/**
 * Build node decorations that add `.bn-example-table` to every table in an example
 * region. Tables are only *painted* — the document is untouched, so markdown
 * serialization round-trips unchanged.
 *
 * The `<!-- example -->` marker, the metadata comment, and the table each become a
 * top-level block whose content node is named by its block type (`exampleMarker`,
 * `testMeta`, `table`), so a single document-order walk yields them directly.
 *
 * Nothing is highlighted unless the document is a suite (see `isSuiteDocument`).
 */
function buildExampleTableDecorations(doc: PMNode): DecorationSet {
  const entries: { pos: number; size: number; name: string }[] = [];
  let firstBlockType: string | undefined;
  let firstBlockMetaKind: string | undefined;

  doc.descendants((node, pos, parent) => {
    // The first content node encountered under a blockContainer is the document's
    // first block — capture its type/metaKind for the suite gate below.
    if (firstBlockType === undefined && parent?.type.name === "blockContainer") {
      firstBlockType = node.type.name;
      const metaKind = node.attrs?.metaKind;
      firstBlockMetaKind = typeof metaKind === "string" ? metaKind : undefined;
    }

    const name = node.type.name;
    if (name === "exampleMarker" || name === "testMeta" || name === "table") {
      entries.push({ pos, size: node.nodeSize, name });
      // No need to descend into table cells or the marker's (empty) internals.
      return false;
    }
    // Descend through the blockGroup / blockContainer wrappers to reach content.
    return undefined;
  });

  if (!isSuiteDocument(firstBlockType, firstBlockMetaKind)) {
    return DecorationSet.empty;
  }

  const flags = markExampleTables(entries.map((entry) => entry.name));
  const decorations = entries
    .filter((_, index) => flags[index])
    .map((entry) =>
      Decoration.node(entry.pos, entry.pos + entry.size, {
        class: "bn-example-table",
      }),
    );

  return DecorationSet.create(doc, decorations);
}

const exampleTablePluginKey = new PluginKey<DecorationSet>("testomatioExampleTable");

function exampleTablePlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: exampleTablePluginKey,
    state: {
      init: (_config, state) => buildExampleTableDecorations(state.doc),
      apply: (tr, value) =>
        tr.docChanged ? buildExampleTableDecorations(tr.doc) : value,
    },
    props: {
      decorations(state) {
        return exampleTablePluginKey.getState(state);
      },
    },
  });
}

/**
 * BlockNote extension that grays the cells of the table following an
 * `<!-- example -->` marker (bounded by the next test/suite comment or the end of
 * the document).
 *
 * Editor extensions are supplied at editor-creation time and cannot be carried by
 * the schema, so consumers must add this to their `useCreateBlockNote` call:
 *
 * ```ts
 * useCreateBlockNote({
 *   schema: customSchema,
 *   extensions: [exampleTableHighlightExtension()],
 * });
 * ```
 */
export class ExampleTableHighlightExtension extends BlockNoteExtension {
  static key() {
    return "exampleTableHighlight";
  }

  constructor() {
    super();
    this.addProsemirrorPlugin(exampleTablePlugin());
  }
}

/** Factory for the `extensions` option of `useCreateBlockNote`. */
export const exampleTableHighlightExtension = () => new ExampleTableHighlightExtension();

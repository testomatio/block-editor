import { BlockNoteExtension } from "@blocknote/core";
import type { Mark, Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorView } from "prosemirror-view";

/**
 * Auto-linking paints bare `http(s)://…` URLs as clickable links *without*
 * modifying the document. Like the tag-badge decoration, the underlying text is
 * left untouched, so markdown serialization round-trips unchanged — a bare URL
 * stays a bare URL (which GFM auto-links anyway) instead of being rewritten into
 * `[url](url)`.
 *
 * A URL is greedily matched as `http://`/`https://` followed by any run of
 * non-whitespace, non-angle-bracket, non-quote characters; trailing sentence
 * punctuation and unbalanced closing brackets are then trimmed so that natural
 * prose like `see https://example.com.` or `(https://example.com)` links the URL
 * without swallowing the surrounding punctuation.
 */
const URL_DETECT_REGEXP = /https?:\/\/[^\s<>"'`]+/gi;

/** Trailing characters that are almost always prose punctuation, not URL. */
const TRAILING_PUNCTUATION = /[.,;:!?'"”’»)\]}]$/;

const CLOSING_TO_OPENING: Record<string, string> = {
  ")": "(",
  "]": "[",
  "}": "{",
};

export interface LinkMatch {
  /** Offset of the first character of the URL within the scanned string. */
  start: number;
  /** Offset just past the last character of the URL. */
  end: number;
  /** The matched URL, used verbatim as the `href`. */
  href: string;
}

function countChar(text: string, char: string): number {
  let count = 0;
  for (const c of text) {
    if (c === char) count++;
  }
  return count;
}

/**
 * Strip trailing punctuation that the greedy match may have swallowed. A closing
 * bracket is only stripped when it is *unbalanced* (no matching opener inside the
 * URL), so real URLs such as a Wikipedia `..._(disambiguation)` link keep their
 * parentheses.
 */
function trimTrailingPunctuation(url: string): string {
  let result = url;
  // Loop because stripping a bracket can expose more punctuation and vice versa,
  // e.g. `https://x.com/a).` → `https://x.com/a)` → `https://x.com/a`.
  for (;;) {
    const last = result[result.length - 1];
    if (last === undefined) break;

    const opening = CLOSING_TO_OPENING[last];
    if (opening) {
      if (countChar(result, last) > countChar(result, opening)) {
        result = result.slice(0, -1);
        continue;
      }
      break;
    }

    if (TRAILING_PUNCTUATION.test(last)) {
      result = result.slice(0, -1);
      continue;
    }

    break;
  }
  return result;
}

/**
 * Find every `http(s)://` URL inside a plain string and return their offsets.
 * Pure and DOM-free so it can be unit-tested directly.
 */
export function detectLinks(text: string): LinkMatch[] {
  const matches: LinkMatch[] = [];
  // Fresh regex per call so the shared `lastIndex` never leaks between calls.
  const regexp = new RegExp(URL_DETECT_REGEXP.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = regexp.exec(text)) !== null) {
    const href = trimTrailingPunctuation(match[0]);
    // The trim only ever removes characters from the end, so `start` is stable.
    if (href.length > 0) {
      matches.push({ start: match.index, end: match.index + href.length, href });
    }
    // Defensive guard against a zero-length match looping forever (a URL always
    // starts with `http`, so this should never trigger).
    if (regexp.lastIndex === match.index) {
      regexp.lastIndex++;
    }
  }
  return matches;
}

const autoLinkPluginKey = new PluginKey<DecorationSet>("testomatioAutoLink");

/**
 * Text carrying a real `link` mark (already an anchor) or a `code` mark
 * (inline code, where a URL is a literal, not a link) is skipped so we never
 * double-decorate or linkify code.
 */
function hasBlockingMark(marks: readonly Mark[]): boolean {
  return marks.some(
    (mark) => mark.type.name === "link" || mark.type.name === "code",
  );
}

/**
 * Build inline decorations for every URL in the document. Code blocks are
 * skipped wholesale; inside every other block, each text node is scanned and any
 * URL that isn't already a link or inline code is painted.
 */
function buildLinkDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    // Never linkify inside code blocks — a URL there is source text, not a link.
    if (node.type.spec.code) {
      return false;
    }

    if (!node.isText || !node.text || hasBlockingMark(node.marks)) {
      return undefined;
    }

    for (const { start, end, href } of detectLinks(node.text)) {
      decorations.push(
        Decoration.inline(
          pos + start,
          pos + end,
          {
            class: "bn-auto-link",
            "data-auto-href": href,
            title: href,
          },
          // Stored on the decoration spec so the click handler can resolve the
          // href from document coordinates without trusting the DOM.
          { autoHref: href },
        ),
      );
    }

    return undefined;
  });

  return DecorationSet.create(doc, decorations);
}

/** True when the pointer event carries the platform "open link" modifier. */
function hasOpenModifier(event: MouseEvent): boolean {
  // Cmd on macOS, Ctrl elsewhere — the same convention as VS Code / IntelliJ.
  return event.metaKey || event.ctrlKey;
}

function findAutoHrefAt(view: EditorView, pos: number): string | null {
  const decorations = autoLinkPluginKey.getState(view.state);
  if (!decorations) return null;
  const found = decorations.find(pos, pos);
  for (const deco of found) {
    const href = (deco.spec as { autoHref?: string }).autoHref;
    if (typeof href === "string") return href;
  }
  return null;
}

function openHref(href: string): void {
  if (typeof window === "undefined") return;
  // `noopener,noreferrer` so the opened tab can't reach back via `window.opener`.
  window.open(href, "_blank", "noopener,noreferrer");
}

interface AutoLinkPluginOptions {
  /**
   * When `true`, a plain click opens the link. When `false` (default), the
   * platform modifier (Cmd/Ctrl) is required so plain clicks still place the
   * text cursor for editing — the safer default inside an editor.
   */
  openOnPlainClick: boolean;
}

function autoLinkPlugin(options: AutoLinkPluginOptions): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: autoLinkPluginKey,
    state: {
      init: (_config, state) => buildLinkDecorations(state.doc),
      apply: (tr, value) =>
        tr.docChanged ? buildLinkDecorations(tr.doc) : value,
    },
    props: {
      decorations(state) {
        return autoLinkPluginKey.getState(state);
      },
      handleClick(view, pos, event) {
        if (!options.openOnPlainClick && !hasOpenModifier(event)) {
          return false;
        }
        const href = findAutoHrefAt(view, pos);
        if (!href) return false;
        event.preventDefault();
        openHref(href);
        return true;
      },
    },
  });
}

/**
 * BlockNote extension that renders bare `http(s)://` URLs as clickable links.
 *
 * Editor extensions are supplied at editor-creation time and cannot be carried
 * by the schema, so consumers add this to their `useCreateBlockNote` call:
 *
 * ```ts
 * useCreateBlockNote({
 *   schema: customSchema,
 *   extensions: [autoLinkExtension()],
 * });
 * ```
 *
 * By default a link opens on Cmd/Ctrl+click (plain clicks still edit the text).
 * Pass `{ openOnPlainClick: true }` to open on a plain click instead.
 */
export class AutoLinkExtension extends BlockNoteExtension {
  static key() {
    return "autoLink";
  }

  constructor(options: Partial<AutoLinkPluginOptions> = {}) {
    super();
    this.addProsemirrorPlugin(
      autoLinkPlugin({ openOnPlainClick: options.openOnPlainClick ?? false }),
    );
  }
}

/** Factory for the `extensions` option of `useCreateBlockNote`. */
export const autoLinkExtension = (options?: Partial<AutoLinkPluginOptions>) =>
  new AutoLinkExtension(options);

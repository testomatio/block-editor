import { TextSelection } from "prosemirror-state";
import type { EditorState, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import {
  getMentionSources,
  parseActiveMention,
  type MentionSource,
} from "./mentionAutocomplete";

/**
 * Re-open BlockNote's suggestion menu for an `@`-token that already exists in
 * the document.
 *
 * BlockNote's `SuggestionMenuPlugin` only ever *activates* from `handleTextInput`
 * — i.e. the moment the trigger character is literally typed — and its state is
 * destroyed by any transaction carrying a `focus`, `blur` or `pointer` meta. So
 * once the editor loses focus mid-mention (`@yan`), clicking back in leaves the
 * menu permanently closed: neither re-focus nor typing more of the token can
 * bring it back, and the user has to delete and retype the `@`.
 *
 * This module re-arms the plugin from the outside whenever the caret comes to
 * rest inside a valid mention token and the menu is closed. Detection reuses
 * {@link parseActiveMention}, so all the trigger rules (the `@` must start a
 * word, whitespace ends the token, longest-prefix source routing) stay in one
 * place and behave identically to the textarea frontend.
 */

/** The subset of the BlockNote editor API this module needs. */
export type MentionReopenEditor = {
  readonly prosemirrorView?: EditorView;
  readonly domElement?: HTMLElement;
  readonly suggestionMenus: { readonly shown: boolean };
  readonly isEditable: boolean;
};

export type MentionReopenOptions = {
  /** Sources to use. Falls back to the global registry (`setMentionSources`). */
  sources?: MentionSource[];
  /** Must match the menu's trigger. Only `@` is supported; anything else is a no-op. */
  triggerCharacter?: string;
};

type MentionHit = {
  /** Document position of the `@`. */
  atPos: number;
  /** Document position of the caret (end of the token). */
  caret: number;
};

/** Keys that move the caret without changing the text. */
const CARET_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** ProseMirror `PluginKey` names are `${name}$…`; BlockNote's is this one. */
const SUGGESTION_PLUGIN_NAME = "SuggestionMenuPlugin";

const noop = () => {};

/**
 * Attach the re-open behavior to a BlockNote editor. Returns a cleanup function.
 *
 * Listeners live on `document` (not on the editor element) so that attaching
 * does not depend on the ProseMirror view already being mounted; each handler
 * checks that the event happened inside this editor.
 */
export function attachMentionReopen(
  editor: MentionReopenEditor,
  options: MentionReopenOptions = {},
): () => void {
  const trigger = options.triggerCharacter ?? "@";
  // `parseActiveMention` only understands `@`; other triggers keep the default
  // (never re-opening) behavior rather than guessing.
  if (trigger !== "@" || typeof document === "undefined") return noop;

  // Position of the `@` the user explicitly dismissed with Escape. Kept until
  // the caret leaves that token so a dismissal is not undone by the next click.
  let dismissedAt: number | null = null;
  let frame = 0;

  const detect = (): MentionHit | null => {
    const view = editor.prosemirrorView;
    if (!view || !editor.isEditable) return null;
    const sources = options.sources ?? getMentionSources();
    if (!sources.length) return null;
    return findMentionAtCaret(view.state, sources);
  };

  const reopen = () => {
    frame = 0;
    if (editor.suggestionMenus.shown) return;
    const hit = detect();
    if (!hit) {
      dismissedAt = null;
      return;
    }
    if (hit.atPos === dismissedAt) return;
    dismissedAt = null;
    const view = editor.prosemirrorView;
    if (!view) return;
    const key = findSuggestionPluginKey(view.state);
    if (!key) return;
    reopenSuggestionMenu(view, key, hit, trigger);
  };

  // Handlers run before the browser has moved the caret (keydown) or before
  // ProseMirror has processed the event, so always re-read on the next frame.
  const schedule = (event: Event) => {
    const dom = editor.domElement;
    if (!dom || !(event.target instanceof Node) || !dom.contains(event.target)) return;
    if (frame) return;
    frame = requestAnimationFrame(reopen);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const dom = editor.domElement;
    if (!dom || !(event.target instanceof Node) || !dom.contains(event.target)) return;
    if (event.key === "Escape") {
      const hit = detect();
      dismissedAt = hit ? hit.atPos : null;
      return;
    }
    // Only caret movement re-opens; typing must not fight the menu's own
    // "no results after N characters" auto-close.
    if (CARET_KEYS.has(event.key)) schedule(event);
  };

  document.addEventListener("focusin", schedule);
  document.addEventListener("mouseup", schedule);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("mouseup", schedule);
    document.removeEventListener("keydown", onKeyDown, true);
  };
}

/**
 * The mention token the caret sits in, as document positions. Returns `null`
 * for non-collapsed selections, code blocks, and any caret that is not inside a
 * token an available source claims.
 */
export function findMentionAtCaret(
  state: EditorState,
  sources: MentionSource[],
): MentionHit | null {
  const selection = state.selection;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if ($from.parent.type.spec.code) return null;

  // Text of the current block up to the caret. Leaf nodes take one position and
  // are rendered as one character here, so string offsets map 1:1 onto document
  // positions relative to `blockStart`.
  const blockStart = $from.start();
  const before = state.doc.textBetween(blockStart, selection.from, "\n", "\n");
  const active = parseActiveMention(before, before.length, sources);
  if (!active) return null;

  return { atPos: blockStart + active.start, caret: selection.from };
}

/** Locate BlockNote's suggestion plugin key without importing its private module. */
function findSuggestionPluginKey(state: EditorState): PluginKey | null {
  for (const plugin of state.plugins) {
    // `key` is the runtime identifier (`"SuggestionMenuPlugin$"`), not part of
    // ProseMirror's public typings; `spec.key` is the PluginKey we need.
    const name = (plugin as unknown as { key?: unknown }).key;
    if (typeof name !== "string" || !name.startsWith(SUGGESTION_PLUGIN_NAME)) continue;
    const key = plugin.spec.key;
    if (key) return key;
  }
  return null;
}

/**
 * Re-arm the suggestion plugin on an existing token.
 *
 * The plugin derives `queryStartPos` from the selection at activation time
 * (`selection.from - triggerCharacter.length`), so activating with the caret at
 * the end of `@yan` would anchor the query — and the highlight decoration — on
 * the wrong character. Hence two transactions: the first activates with the
 * caret parked just after the `@`, the second restores the real caret, which
 * makes the plugin recompute its query as the text in between (`yan`).
 */
function reopenSuggestionMenu(
  view: EditorView,
  key: PluginKey,
  hit: MentionHit,
  trigger: string,
): void {
  const activate = view.state.tr
    .setSelection(TextSelection.create(view.state.doc, hit.atPos + trigger.length))
    .setMeta(key, { triggerCharacter: trigger });
  view.dispatch(activate);

  const restored = view.state;
  const caret = Math.min(hit.caret, restored.doc.content.size);
  view.dispatch(restored.tr.setSelection(TextSelection.create(restored.doc, caret)));
}

/* eslint-disable react-refresh/only-export-components -- the hook colocates
   with its private popup component; they are one cohesive module. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  applyMention,
  buildMentionInsertText,
  filterMentionItems,
  getMentionSources,
  normalizeMentionItems,
  parseActiveMention,
  type ActiveMention,
  type MentionItem,
  type MentionSource,
} from "./mentionAutocomplete";

export type UseMentionAutocompleteOptions = {
  /** The textarea the mentions are typed into (e.g. an OverType instance's textarea). */
  textarea: HTMLTextAreaElement | null;
  /** Reads the current full text. Defaults to `textarea.value`. */
  getText?: () => string;
  /**
   * Writes the full text back and positions the caret. Defaults to mutating
   * `textarea.value` directly; pass a custom writer when a wrapper (OverType,
   * a controlled component) owns the value.
   */
  setText?: (text: string, caret: number) => void;
  /** Sources to use. Falls back to the global registry (`setMentionSources`). */
  sources?: MentionSource[];
  /** Master switch; when false the popup never opens. Default true. */
  enabled?: boolean;
  /**
   * When true (default) the hook attaches its own capture-phase keydown listener
   * to the textarea. Set false to drive navigation yourself via the returned
   * `onKeyDown` (useful when another handler must take priority ordering).
   */
  attachKeyDown?: boolean;
  /** Debounce (ms) before an async `search` runs. Default 150. */
  searchDebounceMs?: number;
};

export type UseMentionAutocompleteResult = {
  /** Render this somewhere in the tree; it portals the popup to `document.body`. */
  overlay: ReactNode;
  /**
   * Feed keydown events here when `attachKeyDown` is false. Returns true when the
   * event was consumed (it also calls preventDefault / stopImmediatePropagation).
   */
  onKeyDown: (event: KeyboardEvent) => boolean;
  isOpen: boolean;
  close: () => void;
};

type CaretRect = { left: number; top: number; bottom: number; height: number };

const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"]);

export function useMentionAutocomplete(
  options: UseMentionAutocompleteOptions,
): UseMentionAutocompleteResult {
  const {
    textarea,
    sources: sourcesProp,
    enabled = true,
    attachKeyDown = true,
    searchDebounceMs = 150,
  } = options;

  const getText = useCallback(
    () => (options.getText ? options.getText() : textarea?.value ?? ""),
    [options, textarea],
  );

  const setText = useCallback(
    (text: string, caret: number) => {
      if (options.setText) {
        options.setText(text, caret);
        return;
      }
      if (!textarea) return;
      textarea.value = text;
      textarea.setSelectionRange(caret, caret);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [options, textarea],
  );

  const [active, setActive] = useState<ActiveMention | null>(null);
  const [items, setItems] = useState<MentionItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [caretRect, setCaretRect] = useState<CaretRect | null>(null);

  // Latest committed active mention, for cheap change-detection in refresh().
  const activeRef = useRef<ActiveMention | null>(null);
  // Cache resolved static item lists per source so provider functions run once.
  const staticCacheRef = useRef(new WeakMap<MentionSource, MentionItem[]>());
  // Cache async search results per `${prefix}::${query}`.
  const searchCacheRef = useRef(new Map<string, MentionItem[]>());

  const sources = sourcesProp ?? getMentionSources();
  const isOpen = enabled && active !== null;

  const close = useCallback(() => {
    activeRef.current = null;
    setActive(null);
    setItems([]);
    setActiveIndex(0);
    setLoading(false);
  }, []);

  /** Re-read the caret and (re)detect the active mention, ignoring no-op changes. */
  const refresh = useCallback(() => {
    let next: ActiveMention | null = null;
    if (enabled && textarea && textarea.selectionStart === textarea.selectionEnd) {
      next = parseActiveMention(getText(), textarea.selectionStart ?? 0, sources);
    }

    const prev = activeRef.current;
    const unchanged =
      (!next && !prev) ||
      (!!next &&
        !!prev &&
        next.source === prev.source &&
        next.token === prev.token &&
        next.start === prev.start &&
        next.end === prev.end);
    if (unchanged) return;

    activeRef.current = next;
    setActive(next);
    if (next && textarea) {
      setCaretRect(caretCoordinates(textarea, next.start));
    }
  }, [enabled, textarea, getText, sources]);

  // Track input + caret movement.
  useEffect(() => {
    if (!textarea || !enabled) return;
    const onInput = () => refresh();
    const onSelectionChange = () => {
      if (document.activeElement === textarea) refresh();
    };
    const onBlur = () => close();
    textarea.addEventListener("input", onInput);
    textarea.addEventListener("blur", onBlur);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      textarea.removeEventListener("input", onInput);
      textarea.removeEventListener("blur", onBlur);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [textarea, enabled, refresh, close]);

  // Resolve items for the active mention (static filter or async search).
  useEffect(() => {
    if (!active) return;
    const { source, query } = active;
    setActiveIndex(0);
    const limit = source.limit ?? 8;

    // Async, server-backed source.
    if (typeof source.search === "function") {
      const minChars = source.minChars ?? 0;
      if (query.length < minChars) {
        setItems([]);
        setLoading(false);
        return;
      }
      const key = `${source.prefix}::${query}`;
      const cached = searchCacheRef.current.get(key);
      if (cached) {
        setItems(cached);
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      const timer = setTimeout(() => {
        Promise.resolve(source.search!(query))
          .then((result) => normalizeMentionItems(result).slice(0, limit))
          .then((resolved) => {
            searchCacheRef.current.set(key, resolved);
            if (!cancelled) {
              setItems(resolved);
              setLoading(false);
            }
          })
          .catch((error) => {
            console.error("Mention search failed", error);
            if (!cancelled) {
              setItems([]);
              setLoading(false);
            }
          });
      }, searchDebounceMs);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    // Static, in-memory source.
    const resolveStatic = (): Promise<MentionItem[]> => {
      const cached = staticCacheRef.current.get(source);
      if (cached) return Promise.resolve(cached);
      const input = source.items;
      const raw = typeof input === "function" ? input() : input ?? [];
      return Promise.resolve(raw).then((list) => {
        const normalized = normalizeMentionItems(list);
        staticCacheRef.current.set(source, normalized);
        return normalized;
      });
    };

    let cancelled = false;
    resolveStatic().then((list) => {
      if (!cancelled) setItems(filterMentionItems(list, query, limit));
    });
    return () => {
      cancelled = true;
    };
  }, [active, searchDebounceMs]);

  const apply = useCallback(
    (item: MentionItem) => {
      if (!active) return;
      const insertText = buildMentionInsertText(active.source, item);
      const result = applyMention(getText(), active, insertText);
      close();
      setText(result.text, result.caret);
      // Return focus to the textarea after the value write settles.
      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(result.caret, result.caret);
      });
    },
    [active, getText, setText, close, textarea],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (!isOpen || !NAV_KEYS.has(event.key)) return false;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
        return true;
      }
      if (items.length === 0) {
        // Swallow nav keys while open with no results only for Escape (handled).
        // Let other keys through so typing/navigation still works.
        return false;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setActiveIndex((prev) => (prev + 1 >= items.length ? 0 : prev + 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setActiveIndex((prev) => (prev - 1 < 0 ? items.length - 1 : prev - 1));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopImmediatePropagation();
        apply(items[activeIndex] ?? items[0]);
        return true;
      }
      return false;
    },
    [isOpen, items, activeIndex, apply, close],
  );

  // Keep a fresh handler for the (optional) self-attached listener.
  const handlerRef = useRef(onKeyDown);
  handlerRef.current = onKeyDown;

  useEffect(() => {
    if (!textarea || !attachKeyDown || !enabled) return;
    const listener = (event: KeyboardEvent) => {
      handlerRef.current(event);
    };
    const opts: AddEventListenerOptions = { capture: true };
    textarea.addEventListener("keydown", listener, opts);
    return () => textarea.removeEventListener("keydown", listener, opts);
  }, [textarea, attachKeyDown, enabled]);

  const overlay = isOpen ? (
    <MentionPopup
      active={active}
      items={items}
      activeIndex={activeIndex}
      loading={loading}
      caretRect={caretRect}
      onHover={setActiveIndex}
      onSelect={apply}
    />
  ) : null;

  return { overlay, onKeyDown, isOpen, close };
}

type MentionPopupProps = {
  active: ActiveMention;
  items: MentionItem[];
  activeIndex: number;
  loading: boolean;
  caretRect: CaretRect | null;
  onHover: (index: number) => void;
  onSelect: (item: MentionItem) => void;
};

function MentionPopup({
  active,
  items,
  activeIndex,
  loading,
  caretRect,
  onHover,
  onSelect,
}: MentionPopupProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  // Keep the highlighted item scrolled into view.
  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, items]);

  if (typeof document === "undefined") return null;

  const style: CSSProperties = caretRect
    ? { position: "fixed", left: caretRect.left, top: caretRect.bottom + 4 }
    : { position: "fixed", left: 16, top: 16 };

  const source = active.source;
  const minChars = source.minChars ?? 0;
  const belowMin = typeof source.search === "function" && active.query.length < minChars;

  return createPortal(
    <div className="bn-mention-popup" role="listbox" style={style} ref={listRef}>
      {source.label && (
        <div className="bn-mention-popup__header">
          <span className="bn-mention-popup__prefix">@{source.prefix}</span>
          <span className="bn-mention-popup__label">{source.label}</span>
        </div>
      )}
      {belowMin ? (
        <div className="bn-mention-popup__status">Keep typing to search…</div>
      ) : loading ? (
        <div className="bn-mention-popup__status">Searching…</div>
      ) : items.length === 0 ? (
        <div className="bn-mention-popup__status">No matches</div>
      ) : (
        items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            role="option"
            data-active={index === activeIndex}
            aria-selected={index === activeIndex}
            className={
              index === activeIndex
                ? "bn-mention-item bn-mention-item--active"
                : "bn-mention-item"
            }
            // onMouseDown (not onClick) + preventDefault keeps the textarea focused.
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(item);
            }}
            onMouseEnter={() => onHover(index)}
            tabIndex={-1}
          >
            <span className="bn-mention-item__label">{item.label}</span>
            {item.detail && <span className="bn-mention-item__detail">{item.detail}</span>}
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ *
 * Caret coordinates via the mirror-div technique. Works for any plain
 * <textarea>; returns viewport (fixed) coordinates of the given index.
 * ------------------------------------------------------------------ */

const MIRROR_PROPS = [
  "boxSizing",
  "width",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "whiteSpace",
  "wordWrap",
  "wordBreak",
] as const;

function caretCoordinates(textarea: HTMLTextAreaElement, position: number): CaretRect {
  const rect = textarea.getBoundingClientRect();
  const fallback: CaretRect = {
    left: rect.left,
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
  };
  if (typeof document === "undefined") return fallback;

  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const cs = mirror.style;
  cs.position = "absolute";
  cs.visibility = "hidden";
  cs.whiteSpace = "pre-wrap";
  cs.overflow = "hidden";
  const sourceStyle = style as unknown as Record<string, string>;
  const mirrorStyle = cs as unknown as Record<string, string>;
  for (const prop of MIRROR_PROPS) {
    mirrorStyle[prop] = sourceStyle[prop];
  }
  cs.width = `${textarea.clientWidth}px`;

  const value = textarea.value;
  mirror.textContent = value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = value.slice(position) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  const left = rect.left + marker.offsetLeft - textarea.scrollLeft;
  const top = rect.top + marker.offsetTop - textarea.scrollTop;
  document.body.removeChild(mirror);

  return { left, top, bottom: top + lineHeight, height: lineHeight };
}

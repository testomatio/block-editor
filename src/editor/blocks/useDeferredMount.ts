import { useEffect, useRef, useState } from "react";

/**
 * Defers mounting of expensive block content until the element is at (or near)
 * the viewport. Heavy blocks (e.g. test steps that each spin up an OverType
 * editor) render a cheap placeholder first; the real interactive content is
 * mounted only once the block scrolls into view. This keeps pasting/loading a
 * large document fast — only the visible steps pay the editor-init cost up
 * front, the rest are upgraded lazily as the user scrolls.
 *
 * Returns a ref to attach to the wrapper element and a boolean that flips to
 * `true` once (and stays true — we never tear an editor back down).
 *
 * `activate(focus)` lets the caller upgrade eagerly on interaction. Passing
 * `focus: true` (a click/focus on the placeholder) records that the freshly
 * mounted content should take focus, so a single click on a preview starts
 * editing. Passive activation (hover pre-warm, scroll-into-view) leaves focus
 * alone via `shouldFocusOnActivate === false`.
 */
export function useDeferredMount<T extends HTMLElement>(
  options: { rootMargin?: string; initiallyActive?: boolean } = {},
): {
  ref: React.RefObject<T | null>;
  active: boolean;
  activate: (focus?: boolean) => void;
  shouldFocusOnActivate: boolean;
} {
  const { rootMargin = "300px 0px", initiallyActive = false } = options;
  const ref = useRef<T>(null);
  const [active, setActive] = useState(initiallyActive);
  const activeRef = useRef(active);
  activeRef.current = active;
  const focusOnActivateRef = useRef(false);

  const activate = (focus = false) => {
    if (activeRef.current) return;
    if (focus) focusOnActivateRef.current = true;
    setActive(true);
  };

  useEffect(() => {
    if (activeRef.current) return;
    const el = ref.current;
    if (!el) return;

    // Environments without IntersectionObserver (or SSR) just mount eagerly.
    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, active, activate, shouldFocusOnActivate: focusOnActivateRef.current };
}

import { useCallback, useEffect, useRef } from "react";

type Options = {
  textarea: HTMLTextAreaElement | null;
  enabled?: boolean;
  onResize: () => void;
};

// Shared across all hook instances: one fonts.ready promise per document,
// fanned out to every registered callback so N fields cost 1 .then().
const fontsReadyCallbacks = new Set<() => void>();
let fontsReadyAttached = false;

function registerFontsReady(cb: () => void): () => void {
  if (typeof document === "undefined" || !document.fonts?.ready) {
    return () => {};
  }
  fontsReadyCallbacks.add(cb);
  if (!fontsReadyAttached) {
    fontsReadyAttached = true;
    document.fonts.ready
      .then(() => {
        for (const fn of fontsReadyCallbacks) fn();
      })
      .catch(() => {});
  }
  return () => {
    fontsReadyCallbacks.delete(cb);
  };
}

export function useAutoResize({ textarea, enabled = true, onResize }: Options) {
  const frameRef = useRef<number>(0);
  const onResizeRef = useRef(onResize);

  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);

  useEffect(() => {
    if (!textarea || !enabled) return;

    let cancelled = false;

    // All callers go through this coalescing scheduler: repeated pings in a
    // single frame collapse to one reflow.
    const schedule = () => {
      if (cancelled) return;
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        if (!cancelled) onResizeRef.current();
      });
    };

    // Initial pass after layout.
    schedule();

    // One-shot: re-run once the textarea actually enters the layout tree.
    // This is the piece that fixes the drag-drop remount and
    // snippet-insert-while-hidden cases OverType itself cannot recover from.
    const intersectionObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          schedule();
          intersectionObserver.disconnect();
          break;
        }
      }
    });
    intersectionObserver.observe(textarea);

    const unregisterFonts = registerFontsReady(schedule);

    return () => {
      cancelled = true;
      intersectionObserver.disconnect();
      unregisterFonts();
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, [textarea, enabled]);

  return useCallback(() => {
    onResizeRef.current();
  }, []);
}

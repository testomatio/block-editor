import { useEffect, useRef } from "react";

type Options = {
  textarea: HTMLTextAreaElement | null;
  multiline?: boolean;
  minRows?: number;
  maxRows?: number;
};

export function useAutoResize({ textarea, multiline = false, minRows = 2, maxRows = 12 }: Options) {
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!textarea || !multiline) {
      return;
    }

    const resize = () => {
      textarea.style.height = "auto";
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight || "16");
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;

      const clampedHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${clampedHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    };

    const mutationObserver = new MutationObserver(resize);
    mutationObserver.observe(textarea, { childList: true, characterData: true, subtree: true });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(textarea);

    const handleInput = () => {
      cancelAnimationFrame(frameRef.current ?? 0);
      frameRef.current = requestAnimationFrame(resize);
    };

    textarea.addEventListener("input", handleInput);

    let cancelled = false;
    const initialFrame = requestAnimationFrame(() => {
      frameRef.current = requestAnimationFrame(() => {
        if (!cancelled) resize();
      });
    });

    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) resize();
      }).catch(() => {});
    }

    return () => {
      cancelled = true;
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      textarea.removeEventListener("input", handleInput);
      cancelAnimationFrame(initialFrame);
      cancelAnimationFrame(frameRef.current ?? 0);
    };
  }, [textarea, multiline, minRows, maxRows]);
}

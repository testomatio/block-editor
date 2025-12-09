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

      textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight)}px`;
    };

    const observer = new MutationObserver(resize);
    observer.observe(textarea, { childList: true, characterData: true, subtree: true });

    const handleInput = () => {
      cancelAnimationFrame(frameRef.current ?? 0);
      frameRef.current = requestAnimationFrame(resize);
    };

    textarea.addEventListener("input", handleInput);
    resize();

    return () => {
      observer.disconnect();
      textarea.removeEventListener("input", handleInput);
      cancelAnimationFrame(frameRef.current ?? 0);
    };
  }, [textarea, multiline, minRows, maxRows]);
}

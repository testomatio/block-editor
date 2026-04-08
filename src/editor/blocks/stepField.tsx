import OverType, { type OverType as OverTypeInstance } from "overtype";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { useComponentsContext } from "@blocknote/react";
import { EditLinkMenuItems } from "@blocknote/react";
import { useStepAutocomplete, type StepSuggestion } from "../stepAutocomplete";
import { type SnippetSuggestion } from "../snippetAutocomplete";
import { useStepImageUpload } from "../stepImageUpload";
import { escapeMarkdownText, normalizePlainText } from "./markdown";
import { useAutoResize } from "./useAutoResize";

type Suggestion = StepSuggestion | SnippetSuggestion;

type StepFieldProps = {
  label: string;
  showLabel?: boolean;
  labelToggle?: {
    onClick: () => void;
    expanded: boolean;
  };
  labelAction?: ReactNode;
  placeholder?: string;
  value: string;
  onChange: (nextValue: string) => void;
  autoFocus?: boolean;
  focusSignal?: number;
  multiline?: boolean;
  enableAutocomplete?: boolean;
  fieldName?: string;
  suggestionFilter?: (suggestion: Suggestion) => boolean;
  suggestionsOverride?: Suggestion[];
  onSuggestionSelect?: (suggestion: Suggestion) => void;
  readOnly?: boolean;
  showSuggestionsOnFocus?: boolean;
  enableImageUpload?: boolean;
  onImageFile?: (file: File) => Promise<void> | void;
  rightAction?: ReactNode;
  showFormattingButtons?: boolean;
  showImageButton?: boolean;
  onFieldFocus?: () => void;
};

const READ_ONLY_ALLOWED_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "Enter",
  "Tab",
]);

const AUTOCOMPLETE_TRIGGER_KEYS = new Set([" ", "Space"]);

const markdownParser = (OverType as { MarkdownParser?: { parse: (markdown: string) => string } }).MarkdownParser;

function ImageUploadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12.667 2C13.0335 2.00008 13.3474 2.13057 13.6084 2.3916C13.8694 2.65264 13.9999 2.96648 14 3.33301V12.667C13.9999 13.0335 13.8694 13.3474 13.6084 13.6084C13.3474 13.8694 13.0335 13.9999 12.667 14H3.33301C2.96648 13.9999 2.65264 13.8694 2.3916 13.6084C2.13057 13.3474 2.00008 13.0335 2 12.667V3.33301C2.00008 2.96648 2.13057 2.65264 2.3916 2.3916C2.65264 2.13057 2.96648 2.00008 3.33301 2H12.667ZM3.33301 12.667H12.667V3.33301H3.33301V12.667ZM12 11.333H4L6 8.66699L7.5 10.667L9.5 8L12 11.333ZM5.66699 4.66699C5.94455 4.66707 6.18066 4.76375 6.375 4.95801C6.56944 5.15245 6.66699 5.38921 6.66699 5.66699C6.66692 5.94463 6.56937 6.18063 6.375 6.375C6.18063 6.56937 5.94463 6.66692 5.66699 6.66699C5.38921 6.66699 5.15245 6.56944 4.95801 6.375C4.76375 6.18066 4.66707 5.94455 4.66699 5.66699C4.66699 5.38921 4.76356 5.15245 4.95801 4.95801C5.15245 4.76356 5.38921 4.66699 5.66699 4.66699Z"
        fill="currentColor"
      />
    </svg>
  );
}

type ExtractedImage = {
  id: string;
  url: string;
  alt: string;
  start: number;
  end: number;
  markdown: string;
};

type LinkMeta = { start: number; end: number; url: string };
type FormattingMeta = { start: number; end: number; type: "bold" | "italic" | "code" };
type FormatType = "bold" | "italic" | "code";

function getActiveFormats(
  formatting: FormattingMeta[],
  selStart: number,
  selEnd: number,
): Set<FormatType> {
  const active = new Set<FormatType>();
  if (selStart === selEnd) return active;
  for (const f of formatting) {
    if (selStart < f.end && selEnd > f.start) {
      active.add(f.type);
    }
  }
  return active;
}


function stripInlineMarkdown(markdown: string): {
  plainText: string;
  links: LinkMeta[];
  formatting: FormattingMeta[];
} {
  const links: LinkMeta[] = [];
  const formatting: FormattingMeta[] = [];
  let plainText = "";
  let i = 0;

  while (i < markdown.length) {
    // Skip image syntax ![alt](url) — keep as-is
    if (markdown[i] === "!" && markdown[i + 1] === "[") {
      const endBracket = markdown.indexOf("]", i + 2);
      if (endBracket !== -1 && markdown[endBracket + 1] === "(") {
        const endParen = markdown.indexOf(")", endBracket + 2);
        if (endParen !== -1) {
          plainText += markdown.slice(i, endParen + 1);
          i = endParen + 1;
          continue;
        }
      }
    }

    // Links: [text](url)
    if (markdown[i] === "[") {
      const endBracket = markdown.indexOf("]", i + 1);
      if (endBracket !== -1 && markdown[endBracket + 1] === "(") {
        const endParen = markdown.indexOf(")", endBracket + 2);
        if (endParen !== -1) {
          const text = markdown.slice(i + 1, endBracket);
          const url = markdown.slice(endBracket + 2, endParen);
          links.push({ start: plainText.length, end: plainText.length + text.length, url });
          plainText += text;
          i = endParen + 1;
          continue;
        }
      }
    }

    // Bold+Italic: *** or ___
    if (
      (markdown[i] === "*" && markdown[i + 1] === "*" && markdown[i + 2] === "*") ||
      (markdown[i] === "_" && markdown[i + 1] === "_" && markdown[i + 2] === "_")
    ) {
      const marker = markdown.slice(i, i + 3);
      const closeIdx = markdown.indexOf(marker, i + 3);
      if (closeIdx !== -1) {
        const inner = markdown.slice(i + 3, closeIdx);
        const start = plainText.length;
        const innerResult = stripInlineMarkdown(inner);
        plainText += innerResult.plainText;
        for (const link of innerResult.links) {
          links.push({ start: start + link.start, end: start + link.end, url: link.url });
        }
        for (const fmt of innerResult.formatting) {
          formatting.push({ start: start + fmt.start, end: start + fmt.end, type: fmt.type });
        }
        formatting.push({ start, end: plainText.length, type: "bold" });
        formatting.push({ start, end: plainText.length, type: "italic" });
        i = closeIdx + 3;
        continue;
      }
    }

    // Bold: ** or __
    if (
      markdown[i] === "*" && markdown[i + 1] === "*" && markdown[i + 2] !== "*" ||
      markdown[i] === "_" && markdown[i + 1] === "_" && markdown[i + 2] !== "_"
    ) {
      const marker = markdown.slice(i, i + 2);
      // Find closing ** that isn't part of ***
      let closeIdx = markdown.indexOf(marker, i + 2);
      while (closeIdx !== -1 && markdown[closeIdx + 2] === marker[0]) {
        closeIdx = markdown.indexOf(marker, closeIdx + 2);
      }
      if (closeIdx !== -1) {
        const inner = markdown.slice(i + 2, closeIdx);
        const start = plainText.length;
        const innerResult = stripInlineMarkdown(inner);
        plainText += innerResult.plainText;
        for (const link of innerResult.links) {
          links.push({ start: start + link.start, end: start + link.end, url: link.url });
        }
        for (const fmt of innerResult.formatting) {
          formatting.push({ start: start + fmt.start, end: start + fmt.end, type: fmt.type });
        }
        formatting.push({ start, end: plainText.length, type: "bold" });
        i = closeIdx + 2;
        continue;
      }
    }

    // Italic: single * or _
    if (
      (markdown[i] === "*" && markdown[i + 1] !== "*") ||
      (markdown[i] === "_" && markdown[i + 1] !== "_")
    ) {
      const marker = markdown[i];
      // Find closing marker that isn't doubled
      let closeIdx = i + 1;
      while (closeIdx < markdown.length) {
        closeIdx = markdown.indexOf(marker, closeIdx);
        if (closeIdx === -1) break;
        if (markdown[closeIdx + 1] !== marker && markdown[closeIdx - 1] !== marker) break;
        closeIdx++;
      }
      if (closeIdx !== -1 && closeIdx > i + 1) {
        const inner = markdown.slice(i + 1, closeIdx);
        const start = plainText.length;
        const innerResult = stripInlineMarkdown(inner);
        plainText += innerResult.plainText;
        for (const link of innerResult.links) {
          links.push({ start: start + link.start, end: start + link.end, url: link.url });
        }
        for (const fmt of innerResult.formatting) {
          formatting.push({ start: start + fmt.start, end: start + fmt.end, type: fmt.type });
        }
        formatting.push({ start, end: plainText.length, type: "italic" });
        i = closeIdx + 1;
        continue;
      }
    }

    // Code block: ```\n...\n``` (triple backticks with newlines)
    if (markdown[i] === "`" && markdown[i + 1] === "`" && markdown[i + 2] === "`") {
      const contentStart = markdown[i + 3] === "\n" ? i + 4 : i + 3;
      const closeIdx = markdown.indexOf("```", contentStart);
      if (closeIdx !== -1) {
        const contentEnd = markdown[closeIdx - 1] === "\n" ? closeIdx - 1 : closeIdx;
        const inner = markdown.slice(contentStart, contentEnd);
        const start = plainText.length;
        plainText += inner;
        formatting.push({ start, end: plainText.length, type: "code" });
        i = closeIdx + 3;
        continue;
      }
    }

    // Inline code: `text`
    if (markdown[i] === "`") {
      const closeIdx = markdown.indexOf("`", i + 1);
      if (closeIdx !== -1) {
        const inner = markdown.slice(i + 1, closeIdx);
        const start = plainText.length;
        plainText += inner;
        formatting.push({ start, end: plainText.length, type: "code" });
        i = closeIdx + 1;
        continue;
      }
    }

    plainText += markdown[i];
    i++;
  }

  return { plainText, links, formatting };
}

function buildFullMarkdown(plainText: string, links: LinkMeta[], formatting: FormattingMeta[]): string {
  if (links.length === 0 && formatting.length === 0) return plainText;

  // Collect all marker insertions at each position in plainText space.
  // Each entry: { pos, text, order } where order controls insertion sequence
  // at the same position (lower order = inserted first = ends up leftmost).
  type Marker = { pos: number; text: string; order: number };
  const markers: Marker[] = [];

  for (const fmt of formatting) {
    let openMarker: string;
    let closeMarker: string;
    if (fmt.type === "code") {
      const content = plainText.slice(fmt.start, fmt.end);
      const isMultiline = content.includes("\n");
      openMarker = isMultiline ? "```\n" : "`";
      closeMarker = isMultiline ? "\n```" : "`";
    } else {
      openMarker = fmt.type === "bold" ? "**" : "*";
      closeMarker = openMarker;
    }
    // Opening: outer markers (bold) before inner (italic) → bold order=0, italic order=1
    // Closing: inner markers (italic) before outer (bold) → italic order=0, bold order=1
    const openOrder = fmt.type === "bold" ? 0 : fmt.type === "code" ? 2 : 1;
    const closeOrder = fmt.type === "bold" ? 1 : fmt.type === "code" ? -1 : 0;
    markers.push({ pos: fmt.start, text: openMarker, order: openOrder });
    markers.push({ pos: fmt.end, text: closeMarker, order: closeOrder });
  }

  for (const link of links) {
    // Link brackets go outside formatting markers
    markers.push({ pos: link.start, text: "[", order: -1 });
    markers.push({ pos: link.end, text: `](${link.url})`, order: 2 });
  }

  // Sort by position descending so we insert from end to start (preserving earlier positions).
  // At the same position, sort by order ascending.
  markers.sort((a, b) => b.pos - a.pos || a.order - b.order);

  let result = plainText;
  for (const m of markers) {
    result = result.slice(0, m.pos) + m.text + result.slice(m.pos);
  }

  return result;
}

function adjustFormattingForEdit(formatting: FormattingMeta[], editPos: number, delta: number): FormattingMeta[] {
  return formatting
    .map((fmt) => {
      if (editPos <= fmt.start) {
        return { ...fmt, start: fmt.start + delta, end: fmt.end + delta };
      }
      if (editPos >= fmt.end) {
        return fmt;
      }
      return { ...fmt, end: fmt.end + delta };
    })
    .filter((fmt) => fmt.end > fmt.start);
}

function getCaretRectInPreview(preview: HTMLElement, offset: number, textareaValue?: string): { top: number; left: number; height: number } | null {
  // Convert textarea-space offset to preview-space (strip newlines)
  let nlCount = 0;
  if (textareaValue) {
    for (let i = 0; i < offset && i < textareaValue.length; i++) {
      if (textareaValue[i] === "\n") nlCount++;
    }
  }
  const previewOffset = offset - nlCount;

  const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const nodeLen = textNode.length;

    if (previewOffset <= currentOffset + nodeLen) {
      const localOffset = previewOffset - currentOffset;
      try {
        const range = document.createRange();
        range.setStart(textNode, localOffset);
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        const previewRect = preview.getBoundingClientRect();
        return {
          top: rect.top - previewRect.top + preview.scrollTop,
          left: rect.left - previewRect.left + preview.scrollLeft,
          height: rect.height || parseFloat(getComputedStyle(preview).lineHeight) || 20,
        };
      } catch {
        return null;
      }
    }

    currentOffset += nodeLen;
  }

  return null;
}

function applyFormattingHighlights(preview: HTMLElement, formatting: FormattingMeta[], textareaValue?: string) {
  // Remove previous formatting highlights
  const existingBold = preview.querySelectorAll("strong.step-preview-bold");
  for (let i = 0; i < existingBold.length; i++) {
    const el = existingBold[i];
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  }
  const existingItalic = preview.querySelectorAll("em.step-preview-italic");
  for (let i = 0; i < existingItalic.length; i++) {
    const el = existingItalic[i];
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  }
  const existingCode = preview.querySelectorAll("code.step-preview-code");
  for (let i = 0; i < existingCode.length; i++) {
    const el = existingCode[i];
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  }

  // After unwrapping formatting elements, merge adjacent/empty text nodes
  // so the tree walker sees clean text nodes matching the original structure.
  preview.normalize();

  if (formatting.length === 0) return;

  // OverType splits textarea lines into <div> elements, discarding the \n
  // characters. Convert textarea-space positions (with \n) to preview-space
  // positions (without \n) so we can find the correct text nodes.
  function taToPreview(taPos: number): number {
    if (!textareaValue) return taPos;
    let nlCount = 0;
    for (let i = 0; i < taPos && i < textareaValue.length; i++) {
      if (textareaValue[i] === "\n") nlCount++;
    }
    return taPos - nlCount;
  }

  const sorted = [...formatting].sort((a, b) => b.start - a.start);

  for (const fmt of sorted) {
    const pStart = taToPreview(fmt.start);
    const pEnd = taToPreview(fmt.end);

    // Collect text nodes with their preview-space offsets
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode: Text | null = null;
    let startLocalOffset = 0;
    let endNode: Text | null = null;
    let endLocalOffset = 0;

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + textNode.length;

      if (!startNode && pStart >= nodeStart && pStart < nodeEnd) {
        startNode = textNode;
        startLocalOffset = pStart - nodeStart;
      }
      if (!endNode && pEnd > nodeStart && pEnd <= nodeEnd) {
        endNode = textNode;
        endLocalOffset = pEnd - nodeStart;
      }

      currentOffset = nodeEnd;
      if (startNode && endNode) break;
    }

    if (!startNode || !endNode) continue;

    const tagName = fmt.type === "bold" ? "strong" : fmt.type === "code" ? "code" : "em";
    const className = fmt.type === "bold" ? "step-preview-bold" : fmt.type === "code" ? "step-preview-code" : "step-preview-italic";

    // If start and end are in the same text node, wrap directly
    if (startNode === endNode) {
      try {
        const range = document.createRange();
        range.setStart(startNode, startLocalOffset);
        range.setEnd(endNode, endLocalOffset);
        const wrapper = document.createElement(tagName);
        wrapper.className = className;
        const fragment = range.extractContents();
        wrapper.appendChild(fragment);
        range.insertNode(wrapper);
      } catch {
        // DOM manipulation can fail if range crosses element boundaries
      }
    } else {
      // Multi-node range (e.g. code spanning multiple lines/divs):
      // collect all text nodes in the range, then wrap each one individually
      const textNodes: { node: Text; localStart: number; localEnd: number }[] = [];
      const walker2 = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
      let collecting = false;
      while (walker2.nextNode()) {
        const tn = walker2.currentNode as Text;
        if (tn === startNode) {
          collecting = true;
          textNodes.push({ node: tn, localStart: startLocalOffset, localEnd: tn.length });
        } else if (tn === endNode) {
          textNodes.push({ node: tn, localStart: 0, localEnd: endLocalOffset });
          break;
        } else if (collecting) {
          textNodes.push({ node: tn, localStart: 0, localEnd: tn.length });
        }
      }
      // Wrap in reverse order to preserve offsets
      for (let ti = textNodes.length - 1; ti >= 0; ti--) {
        const { node, localStart, localEnd } = textNodes[ti];
        if (localStart >= localEnd) continue;
        try {
          const range = document.createRange();
          range.setStart(node, localStart);
          range.setEnd(node, localEnd);
          const wrapper = document.createElement(tagName);
          wrapper.className = className;
          const fragment = range.extractContents();
          wrapper.appendChild(fragment);
          range.insertNode(wrapper);
        } catch {
          // skip nodes that can't be wrapped
        }
      }
    }
  }
}


function adjustLinksForEdit(links: LinkMeta[], editPos: number, delta: number): LinkMeta[] {
  return links
    .map((link) => {
      if (editPos <= link.start) {
        return { ...link, start: link.start + delta, end: link.end + delta };
      }
      if (editPos >= link.end) {
        return link;
      }
      return { ...link, end: link.end + delta };
    })
    .filter((link) => link.end > link.start);
}

function applyLinkHighlights(preview: HTMLElement, links: LinkMeta[]) {
  if (links.length === 0) return;

  // Remove previous link highlights
  const existing = preview.querySelectorAll("a.step-preview-link");
  for (let i = 0; i < existing.length; i++) {
    const el = existing[i];
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    }
  }

  const sorted = [...links].sort((a, b) => b.start - a.start);

  for (const link of sorted) {
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
    let currentOffset = 0;
    let startNode: Text | null = null;
    let startLocalOffset = 0;
    let endNode: Text | null = null;
    let endLocalOffset = 0;

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + textNode.length;

      if (!startNode && link.start >= nodeStart && link.start < nodeEnd) {
        startNode = textNode;
        startLocalOffset = link.start - nodeStart;
      }
      if (!endNode && link.end > nodeStart && link.end <= nodeEnd) {
        endNode = textNode;
        endLocalOffset = link.end - nodeStart;
      }

      currentOffset = nodeEnd;
      if (startNode && endNode) break;
    }

    if (!startNode || !endNode) continue;

    try {
      const range = document.createRange();
      range.setStart(startNode, startLocalOffset);
      range.setEnd(endNode, endLocalOffset);

      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.className = "step-preview-link";

      const fragment = range.extractContents();
      anchor.appendChild(fragment);
      range.insertNode(anchor);
    } catch {
      // DOM manipulation can fail if range crosses element boundaries unexpectedly
    }
  }
}

function markdownToPlainText(markdown: string): string {
  if (!markdown) {
    return "";
  }

  try {
    const html = markdownParser?.parse ? markdownParser.parse(markdown) : markdown;
    if (typeof document === "undefined") {
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    const temp = document.createElement("div");
    temp.innerHTML = html;
    return (temp.textContent ?? "").replace(/\s+/g, " ").trim();
  } catch {
    return markdown.replace(/!\[[^\]]*]\([^)]+\)/g, "").replace(/\[[^\]]*]\([^)]+\)/g, "").replace(/[*_`~]/g, "").replace(/\s+/g, " ").trim();
  }
}

export function StepField({
  label,
  showLabel = true,
  labelToggle,
  labelAction,
  placeholder,
  value,
  onChange,
  autoFocus,
  focusSignal,
  multiline = false,
  enableAutocomplete = false,
  fieldName,
  suggestionFilter,
  suggestionsOverride,
  onSuggestionSelect,
  readOnly = false,
  showSuggestionsOnFocus = false,
  enableImageUpload = false,
  onImageFile,
  rightAction,
  showFormattingButtons = false,
  showImageButton = false,
  onFieldFocus,
}: StepFieldProps) {
  const stepSuggestions = useStepAutocomplete();
  const suggestions = suggestionsOverride ?? stepSuggestions;
  const uploadImage = useStepImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<OverTypeInstance | null>(null);
  const [textareaNode, setTextareaNode] = useState<HTMLTextAreaElement | null>(null);
  const autoFocusRef = useRef(false);
  const pendingFocusRef = useRef(false);
  const initialValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [plainTextValue, setPlainTextValue] = useState(() => markdownToPlainText(value));
  const [isFocused, setIsFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const linkSelectionRef = useRef<{ start: number; end: number; text: string } | null>(null);
  const linksRef = useRef<LinkMeta[]>([]);
  const formattingRef = useRef<FormattingMeta[]>([]);
  const formattingUndoRef = useRef<Array<{ formatting: FormattingMeta[]; links: LinkMeta[] }>>([]);
  const formattingRedoRef = useRef<Array<{ formatting: FormattingMeta[]; links: LinkMeta[] }>>([]);
  const caretRef = useRef<HTMLDivElement | null>(null);
  const prevTextRef = useRef("");
  const isSyncingRef = useRef(false);
  const [cursorLink, setCursorLink] = useState<LinkMeta | null>(null);
  const [activeFormats, setActiveFormats] = useState<Set<FormatType>>(new Set());
  const [linkActive, setLinkActive] = useState(false);
  const Components = useComponentsContext();
  const resolvedPlaceholder = placeholder ?? "";

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleEditorChange = useCallback((nextValue: string) => {
    if (isSyncingRef.current) return;

    const prevText = prevTextRef.current;
    const delta = nextValue.length - prevText.length;

    // Find where the edit happened by comparing old and new text
    let editPos = 0;
    const minLen = Math.min(prevText.length, nextValue.length);
    while (editPos < minLen && prevText[editPos] === nextValue[editPos]) {
      editPos++;
    }

    linksRef.current = adjustLinksForEdit(linksRef.current, editPos, delta);
    formattingRef.current = adjustFormattingForEdit(formattingRef.current, editPos, delta);
    formattingUndoRef.current = [];
    formattingRedoRef.current = [];
    prevTextRef.current = nextValue;

    const markdown = buildFullMarkdown(nextValue, linksRef.current, formattingRef.current);
    setPlainTextValue((prev) => {
      const normalized = markdownToPlainText(markdown);
      return prev === normalized ? prev : normalized;
    });
    onChangeRef.current?.(markdown);
  }, []);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) {
      return;
    }

    const { plainText, links, formatting } = stripInlineMarkdown(initialValueRef.current);
    linksRef.current = links;
    formattingRef.current = formatting;
    prevTextRef.current = plainText;

    const [instance] = OverType.init(container, {
      value: plainText,
      placeholder: resolvedPlaceholder,
      autoResize: multiline,
      minHeight: multiline ? "4rem" : "2.5rem",
      padding: "0.5rem 0.75rem",
      fontSize: "0.95rem",
      onChange: handleEditorChange,
    });

    // Monkey-patch updatePreview to add link highlights
    const originalUpdatePreview = instance.updatePreview.bind(instance);
    instance.updatePreview = function () {
      originalUpdatePreview();
      applyFormattingHighlights(this.preview, formattingRef.current, this.textarea?.value);
      applyLinkHighlights(this.preview, linksRef.current);
    };
    // Apply initial highlights
    applyFormattingHighlights(instance.preview, formattingRef.current, instance.textarea?.value);
    applyLinkHighlights(instance.preview, linksRef.current);

    // Create custom caret element inside the wrapper
    const caretEl = document.createElement("div");
    caretEl.className = "bn-step-custom-caret";
    instance.wrapper.appendChild(caretEl);
    caretRef.current = caretEl;

    editorInstanceRef.current = instance;
    setTextareaNode(instance.textarea);

    return () => {
      caretRef.current = null;
      instance.destroy();
      editorInstanceRef.current = null;
      setTextareaNode(null);
    };
  }, [handleEditorChange, multiline, resolvedPlaceholder]);

  // Custom caret: position based on preview text metrics (handles bold/italic width differences)
  useEffect(() => {
    const instance = editorInstanceRef.current;
    const caret = caretRef.current;
    if (!textareaNode || !instance || !caret) return;

    const updateCaret = () => {
      const hasFormatting = formattingRef.current.length > 0;

      if (!hasFormatting) {
        caret.style.display = "none";
        textareaNode.classList.remove("bn-step-caret-hidden");
        return;
      }

      // Always hide native caret when formatting exists
      textareaNode.classList.add("bn-step-caret-hidden");

      const isFocused = document.activeElement === textareaNode;
      if (!isFocused) {
        caret.style.display = "none";
        return;
      }

      const pos = textareaNode.selectionStart ?? 0;
      const selEnd = textareaNode.selectionEnd ?? 0;

      // Hide custom caret when there's a selection range
      if (pos !== selEnd) {
        caret.style.display = "none";
        return;
      }

      const rect = getCaretRectInPreview(instance.preview, pos, instance.textarea?.value);
      if (rect) {
        caret.style.display = "block";
        caret.style.top = `${rect.top}px`;
        caret.style.left = `${rect.left}px`;
        caret.style.height = `${rect.height}px`;
      } else {
        caret.style.display = "none";
      }
    };

    const onSelectionChange = () => {
      if (document.activeElement === textareaNode) {
        updateCaret();
      }
    };

    const onBlur = () => {
      caret.style.display = "none";
    };

    const onFocus = () => {
      updateCaret();
    };

    const deferredUpdate = () => requestAnimationFrame(updateCaret);

    document.addEventListener("selectionchange", onSelectionChange);
    textareaNode.addEventListener("input", deferredUpdate);
    textareaNode.addEventListener("focus", onFocus);
    textareaNode.addEventListener("blur", onBlur);

    // Initial update
    updateCaret();

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      textareaNode.removeEventListener("input", deferredUpdate);
      textareaNode.removeEventListener("focus", onFocus);
      textareaNode.removeEventListener("blur", onBlur);
      textareaNode.classList.remove("bn-step-caret-hidden");
    };
  }, [textareaNode]);

  useEffect(() => {
    if (pendingFocusRef.current && textareaNode) {
      pendingFocusRef.current = false;
      textareaNode.focus();
    }
  }, [textareaNode]);

  useEffect(() => {
    if (!textareaNode || !focusSignal) {
      return;
    }
    textareaNode.focus();
  }, [focusSignal, textareaNode]);

  useEffect(() => {
    const instance = editorInstanceRef.current;
    if (!instance) {
      setPlainTextValue((prev) => {
        const normalized = markdownToPlainText(value);
        return prev === normalized ? prev : normalized;
      });
      return;
    }

    const { plainText, links, formatting } = stripInlineMarkdown(value);
    linksRef.current = links;
    formattingRef.current = formatting;
    prevTextRef.current = plainText;

    if (instance.getValue() !== plainText) {
      isSyncingRef.current = true;
      instance.setValue(plainText);
      isSyncingRef.current = false;
    } else {
      // Even if text didn't change, formatting/links might have — re-apply highlights
      applyFormattingHighlights(instance.preview, formatting, instance.textarea?.value);
      applyLinkHighlights(instance.preview, links);
    }

    setPlainTextValue((prev) => {
      const normalized = markdownToPlainText(value);
      return prev === normalized ? prev : normalized;
    });
  }, [value]);

  useEffect(() => {
    if (!textareaNode) {
      return;
    }

    if (fieldName) {
      textareaNode.dataset.stepField = fieldName;
    } else {
      delete textareaNode.dataset.stepField;
    }
  }, [fieldName, textareaNode]);

  useEffect(() => {
    if (!textareaNode) {
      return;
    }

    textareaNode.readOnly = readOnly;
  }, [readOnly, textareaNode]);

  useAutoResize({
    textarea: textareaNode,
    multiline,
    minRows: 3,
    maxRows: 16,
  });

  useEffect(() => {
    if (!textareaNode) {
      return;
    }

    const handleFocus = () => {
      setIsFocused(true);
      if (showSuggestionsOnFocus && enableAutocomplete) {
        setShowAllSuggestions(true);
      }
      onFieldFocus?.();
    };

    const handleBlur = () => {
      setIsFocused(false);
      setShowAllSuggestions(false);
    };

    textareaNode.addEventListener("focus", handleFocus);
    textareaNode.addEventListener("blur", handleBlur);

    return () => {
      textareaNode.removeEventListener("focus", handleFocus);
      textareaNode.removeEventListener("blur", handleBlur);
    };
  }, [enableAutocomplete, onFieldFocus, showSuggestionsOnFocus, textareaNode]);

  // Detect when cursor is inside a link for showing edit tooltip
  useEffect(() => {
    if (!textareaNode) return;

    const checkCursorInLink = () => {
      const pos = textareaNode.selectionStart;
      const isCollapsed = textareaNode.selectionStart === textareaNode.selectionEnd;
      if (!isCollapsed) {
        setCursorLink(null);
        return;
      }
      const found = linksRef.current.find((l) => pos >= l.start && pos <= l.end);
      setCursorLink(found ?? null);
    };

    textareaNode.addEventListener("click", checkCursorInLink);
    textareaNode.addEventListener("keyup", checkCursorInLink);
    textareaNode.addEventListener("blur", () => setCursorLink(null));
    return () => {
      textareaNode.removeEventListener("click", checkCursorInLink);
      textareaNode.removeEventListener("keyup", checkCursorInLink);
    };
  }, [textareaNode]);

  useEffect(() => {
    if (!autoFocus || autoFocusRef.current || !textareaNode) {
      return;
    }

    autoFocusRef.current = true;
    const focus = () => {
      textareaNode.focus();
      if (showSuggestionsOnFocus && enableAutocomplete) {
        setShowAllSuggestions(true);
      }
    };

    if (typeof requestAnimationFrame === "function") {
      const frame = requestAnimationFrame(focus);
      return () => cancelAnimationFrame(frame);
    }

    const timeout = setTimeout(focus, 0);
    return () => clearTimeout(timeout);
  }, [autoFocus, enableAutocomplete, showSuggestionsOnFocus, textareaNode]);

  const insertImageMarkdown = useCallback(
    (url: string) => {
      const instance = editorInstanceRef.current;
      const textarea = textareaNode;
      if (!instance || !textarea) {
        return;
      }

      const currentValue = instance.getValue();
      const start = textarea.selectionStart ?? currentValue.length;
      const end = textarea.selectionEnd ?? currentValue.length;
      const before = currentValue.slice(0, start);
      const after = currentValue.slice(end);
      const needsBeforeNewline = before.length > 0 && !before.endsWith("\n");
      const needsAfterNewline = after.length > 0 && !after.startsWith("\n");
      const insertText = `${needsBeforeNewline ? "\n" : ""}![](${url})${needsAfterNewline ? "\n" : ""}`;
      const nextValue = `${before}${insertText}${after}`;

      // setValue triggers updatePreview → handleEditorChange which reconstructs markdown with links
      instance.setValue(nextValue);

      requestAnimationFrame(() => {
        textarea.selectionStart = start + insertText.length;
        textarea.selectionEnd = start + insertText.length;
        textarea.focus();
      });
    },
    [textareaNode],
  );

  useEffect(() => {
    if (!textareaNode) {
      return;
    }

    const handlePaste = async (event: ClipboardEvent) => {
      if (!onImageFile && !(enableImageUpload && uploadImage)) {
        return;
      }

      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
      const file = imageItem?.getAsFile();
      if (!file) {
        return;
      }

      event.preventDefault();

      if (onImageFile) {
        await onImageFile(file);
        return;
      }

      if (enableImageUpload && uploadImage) {
        try {
          const result = await uploadImage(file);
          if (result?.url) {
            insertImageMarkdown(result.url);
          }
        } catch (error) {
          console.error("Failed to upload pasted image", error);
        }
      }
    };

    const listener = (event: ClipboardEvent) => {
      void handlePaste(event);
    };

    textareaNode.addEventListener("paste", listener);
    return () => {
      textareaNode.removeEventListener("paste", listener);
    };
  }, [enableImageUpload, insertImageMarkdown, onImageFile, textareaNode, uploadImage]);

  const handleToolbarAction = useCallback(
    (action: "toggleBold" | "toggleItalic" | "toggleCode") => {
      const instance = editorInstanceRef.current;
      if (!textareaNode || !instance) {
        return;
      }
      textareaNode.focus();

      const fmtType: "bold" | "italic" | "code" = action === "toggleBold" ? "bold" : action === "toggleCode" ? "code" : "italic";
      const rawStart = textareaNode.selectionStart ?? 0;
      const rawEnd = textareaNode.selectionEnd ?? 0;

      // Trim leading/trailing whitespace from the selection so that
      // formatting markers wrap only the meaningful content.
      const selectedText = textareaNode.value.slice(rawStart, rawEnd);
      const leadingWs = selectedText.match(/^(\s*)/)?.[1].length ?? 0;
      const trailingWs = selectedText.match(/(\s*)$/)?.[1].length ?? 0;
      const start = rawStart + leadingWs;
      const end = rawEnd - trailingWs;

      // If selection is all whitespace, nothing to format
      if (start >= end) return;

      // Check if selection is already formatted
      const existingIdx = formattingRef.current.findIndex(
        (f) => f.type === fmtType && f.start <= start && f.end >= end,
      );

      // Save current state for undo before modifying
      formattingUndoRef.current = [
        ...formattingUndoRef.current,
        { formatting: [...formattingRef.current], links: [...linksRef.current] },
      ];
      formattingRedoRef.current = [];

      if (existingIdx !== -1) {
        // Remove formatting
        formattingRef.current = formattingRef.current.filter((_, i) => i !== existingIdx);
      } else if (start !== end) {
        // Remove overlapping formatting of other types before applying new format
        formattingRef.current = formattingRef.current.filter(
          (f) => f.type === fmtType || f.start >= end || f.end <= start,
        );
        // Add formatting for selection
        formattingRef.current = [...formattingRef.current, { start, end, type: fmtType }];
      } else {
        // No selection — nothing to format
        formattingUndoRef.current = formattingUndoRef.current.slice(0, -1);
        return;
      }

      const currentValue = instance.getValue();
      prevTextRef.current = currentValue;

      const markdown = buildFullMarkdown(currentValue, linksRef.current, formattingRef.current);
      onChangeRef.current?.(markdown);
      setPlainTextValue(markdownToPlainText(markdown));

      // Re-apply highlights
      applyFormattingHighlights(instance.preview, formattingRef.current, textareaNode?.value);
      applyLinkHighlights(instance.preview, linksRef.current);
    },
    [textareaNode],
  );

  const updateActiveFormats = useCallback(() => {
    if (!textareaNode) return;
    const selStart = textareaNode.selectionStart ?? 0;
    const selEnd = textareaNode.selectionEnd ?? 0;
    const next = getActiveFormats(formattingRef.current, selStart, selEnd);
    setActiveFormats((prev) => {
      if (prev.size === next.size && [...prev].every((t) => next.has(t))) return prev;
      return next;
    });
    const hasLink = selStart !== selEnd && linksRef.current.some((l) => selStart < l.end && selEnd > l.start);
    setLinkActive(hasLink);
  }, [textareaNode]);

  useEffect(() => {
    if (!textareaNode) return;

    const onSelectionChange = () => {
      if (document.activeElement === textareaNode) {
        updateActiveFormats();
      }
    };

    const onBlur = () => {
      setActiveFormats(new Set());
      setLinkActive(false);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    textareaNode.addEventListener("keyup", updateActiveFormats);
    textareaNode.addEventListener("mouseup", updateActiveFormats);
    textareaNode.addEventListener("blur", onBlur);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      textareaNode.removeEventListener("keyup", updateActiveFormats);
      textareaNode.removeEventListener("mouseup", updateActiveFormats);
      textareaNode.removeEventListener("blur", onBlur);
    };
  }, [textareaNode, updateActiveFormats]);

  const linkPopoverRef = useRef<HTMLDivElement>(null);

  // Close link popover on outside click
  useEffect(() => {
    if (!showLinkPopover) return;

    const handleMouseDown = (event: MouseEvent) => {
      const popover = linkPopoverRef.current;
      if (popover && !popover.contains(event.target as Node)) {
        setShowLinkPopover(false);
        linkSelectionRef.current = null;
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [showLinkPopover]);

  const handleOpenLinkPopover = useCallback(() => {
    if (!textareaNode) {
      return;
    }
    const start = textareaNode.selectionStart ?? 0;
    const end = textareaNode.selectionEnd ?? 0;
    const text = textareaNode.value.slice(start, end);
    linkSelectionRef.current = { start, end, text };
    setShowLinkPopover(true);
  }, [textareaNode]);

  const handleEditLink = useCallback(
    (url: string, text: string) => {
      const instance = editorInstanceRef.current;
      const sel = linkSelectionRef.current;
      if (!instance || !sel || !url) {
        setShowLinkPopover(false);
        linkSelectionRef.current = null;
        return;
      }
      const currentValue = instance.getValue();
      const linkText = text || sel.text || url;

      // Replace selected text with link display text (no markdown syntax in textarea)
      const before = currentValue.slice(0, sel.start);
      const after = currentValue.slice(sel.end);
      const nextValue = `${before}${linkText}${after}`;

      // Remove any existing link that overlaps this selection, then add the new one
      const delta = linkText.length - (sel.end - sel.start);
      const adjustedLinks = adjustLinksForEdit(
        linksRef.current.filter((l) => !(l.start < sel.end && l.end > sel.start)),
        sel.start,
        delta,
      );
      const newLink: LinkMeta = { start: sel.start, end: sel.start + linkText.length, url };
      linksRef.current = [...adjustedLinks, newLink];
      formattingRef.current = adjustFormattingForEdit(formattingRef.current, sel.start, delta);
      prevTextRef.current = nextValue;

      isSyncingRef.current = true;
      instance.setValue(nextValue);
      isSyncingRef.current = false;

      const markdown = buildFullMarkdown(nextValue, linksRef.current, formattingRef.current);
      onChangeRef.current?.(markdown);
      setPlainTextValue(markdownToPlainText(markdown));
      setShowLinkPopover(false);
      linkSelectionRef.current = null;
      setCursorLink(null);
      requestAnimationFrame(() => textareaNode?.focus());
    },
    [textareaNode],
  );

  const handleRemoveLink = useCallback(() => {
    linksRef.current = linksRef.current.filter((l) => l !== cursorLink);
    setCursorLink(null);

    const instance = editorInstanceRef.current;
    if (instance) {
      const markdown = buildFullMarkdown(instance.getValue(), linksRef.current, formattingRef.current);
      onChangeRef.current?.(markdown);
      // Re-apply highlights since links changed
      applyFormattingHighlights(instance.preview, formattingRef.current, instance.textarea?.value);
      applyLinkHighlights(instance.preview, linksRef.current);
    }
  }, [cursorLink]);

  const suggestionPool = useMemo(() => {
    if (!suggestionFilter) {
      return suggestions;
    }
    const filtered = suggestions.filter(suggestionFilter);
    return filtered.length > 0 ? filtered : suggestions;
  }, [suggestionFilter, suggestions]);

  const normalizedQuery = normalizePlainText(plainTextValue);

  useEffect(() => {
    if (normalizedQuery.length > 0) {
      setShowAllSuggestions(false);
    }
  }, [normalizedQuery]);

  const filteredSuggestions = useMemo(() => {
    if (!enableAutocomplete) {
      return [];
    }

    const pool = showAllSuggestions || !normalizedQuery
      ? suggestionPool
      : suggestionPool.filter((item) => normalizePlainText(item.title).startsWith(normalizedQuery));

    return pool.slice(0, 8);
  }, [enableAutocomplete, normalizedQuery, showAllSuggestions, suggestionPool]);

  const hasExactMatch = filteredSuggestions.some(
    (item) => normalizePlainText(item.title) === normalizedQuery,
  );

  const shouldShowAutocomplete =
    enableAutocomplete &&
    isFocused &&
    filteredSuggestions.length > 0 &&
    (!hasExactMatch || showAllSuggestions) &&
    (showAllSuggestions || normalizedQuery.length >= 1);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [normalizedQuery, filteredSuggestions.length, showAllSuggestions]);

  const extractedImages = useMemo<ExtractedImage[]>(() => {
    if (!value) {
      return [];
    }

    const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const results: ExtractedImage[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(value)) !== null) {
      const [, alt = "", url = ""] = match;
      results.push({
        id: `${match.index}-${url}-${results.length}`,
        url,
        alt,
        start: match.index,
        end: match.index + match[0].length,
        markdown: match[0],
      });
    }
    return results;
  }, [value]);

  const handleRemoveImage = useCallback(
    (image: ExtractedImage) => {
      const before = value.slice(0, image.start);
      const after = value.slice(image.end);
      const nextValue = `${before}${after}`.replace(/\n{3,}/g, "\n\n");
      if (editorInstanceRef.current) {
        editorInstanceRef.current.setValue(nextValue);
      }
      onChangeRef.current?.(nextValue);
      setPlainTextValue(markdownToPlainText(nextValue));
      setPreviewImageUrl((prev) => (prev === image.url ? null : prev));
    },
    [value],
  );

  const handleImageClick = useCallback((url: string) => {
    setPreviewImageUrl(url);
  }, []);

  const focusAdjacentField = useCallback(
    (direction: 1 | -1) => {
      if (!textareaNode || typeof document === "undefined") {
        return false;
      }

      const selector =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"], [data-step-field]';
      const focusable = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
        if (element.getAttribute("aria-hidden") === "true" || element.tabIndex === -1 || element.hasAttribute("disabled")) {
          return false;
        }
        const isVisible = element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;
        return isVisible;
      });
      const currentIndex = focusable.findIndex((element) => element === textareaNode);
      const target = currentIndex === -1 ? null : focusable[currentIndex + direction];
      if (!target) {
        return false;
      }
      target.focus();
      return true;
    },
    [textareaNode],
  );

  const applySuggestion = useCallback(
    (suggestion: Suggestion) => {
      const escaped = escapeMarkdownText(suggestion.title);
      const instance = editorInstanceRef.current;
      if (instance) {
        instance.setValue(escaped);
      }
      setPlainTextValue(suggestion.title);
      onChangeRef.current?.(escaped);
      onSuggestionSelect?.(suggestion);
      setActiveSuggestionIndex(0);
      setShowAllSuggestions(false);
      requestAnimationFrame(() => {
        textareaNode?.focus();
        if (textareaNode) {
          textareaNode.selectionStart = escaped.length;
          textareaNode.selectionEnd = escaped.length;
        }
      });
    },
    [onSuggestionSelect, textareaNode],
  );

  const keydownHandlerRef = useRef<((event: KeyboardEvent) => void) | null>(null);

  useEffect(() => {
    keydownHandlerRef.current = (event: KeyboardEvent) => {
      if (readOnly) {
        const openKeys = enableAutocomplete && (event.metaKey || event.ctrlKey) && AUTOCOMPLETE_TRIGGER_KEYS.has(event.code);
        if (!READ_ONLY_ALLOWED_KEYS.has(event.key) && !openKeys) {
          event.preventDefault();
          return;
        }
      }

      // Intercept Ctrl+B / Ctrl+I to use our formatting system instead of OverType's
      const modKey = navigator.platform?.toLowerCase().includes("mac") ? event.metaKey : event.ctrlKey;
      if (modKey && !event.shiftKey) {
        if (event.key === "b" || event.key === "B") {
          event.preventDefault();
          event.stopImmediatePropagation();
          handleToolbarAction("toggleBold");
          return;
        }
        if (event.key === "i" || event.key === "I") {
          event.preventDefault();
          event.stopImmediatePropagation();
          handleToolbarAction("toggleItalic");
          return;
        }
        if (event.key === "e" || event.key === "E") {
          event.preventDefault();
          event.stopImmediatePropagation();
          handleToolbarAction("toggleCode");
          return;
        }
        if (event.key === "z" || event.key === "Z") {
          const undoStack = formattingUndoRef.current;
          if (undoStack.length > 0) {
            event.preventDefault();
            event.stopImmediatePropagation();
            formattingRedoRef.current = [
              ...formattingRedoRef.current,
              { formatting: [...formattingRef.current], links: [...linksRef.current] },
            ];
            const prev = undoStack[undoStack.length - 1];
            formattingUndoRef.current = undoStack.slice(0, -1);
            formattingRef.current = prev.formatting;
            linksRef.current = prev.links;
            const instance = editorInstanceRef.current;
            if (instance) {
              const markdown = buildFullMarkdown(instance.getValue(), linksRef.current, formattingRef.current);
              onChangeRef.current?.(markdown);
              setPlainTextValue(markdownToPlainText(markdown));
              applyFormattingHighlights(instance.preview, formattingRef.current, instance.textarea?.value);
              applyLinkHighlights(instance.preview, linksRef.current);
            }
            return;
          }
        }
      }
      if (modKey && event.shiftKey && (event.key === "z" || event.key === "Z")) {
        const redoStack = formattingRedoRef.current;
        if (redoStack.length > 0) {
          event.preventDefault();
          event.stopImmediatePropagation();
          formattingUndoRef.current = [
            ...formattingUndoRef.current,
            { formatting: [...formattingRef.current], links: [...linksRef.current] },
          ];
          const next = redoStack[redoStack.length - 1];
          formattingRedoRef.current = redoStack.slice(0, -1);
          formattingRef.current = next.formatting;
          linksRef.current = next.links;
          const instance = editorInstanceRef.current;
          if (instance) {
            const markdown = buildFullMarkdown(instance.getValue(), linksRef.current, formattingRef.current);
            onChangeRef.current?.(markdown);
            setPlainTextValue(markdownToPlainText(markdown));
            applyFormattingHighlights(instance.preview, formattingRef.current, instance.textarea?.value);
            applyLinkHighlights(instance.preview, linksRef.current);
          }
          return;
        }
      }

      if (enableAutocomplete && shouldShowAutocomplete) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setActiveSuggestionIndex((prev) =>
            prev + 1 >= filteredSuggestions.length ? 0 : prev + 1,
          );
          return;
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setActiveSuggestionIndex((prev) =>
            prev - 1 < 0 ? filteredSuggestions.length - 1 : prev - 1,
          );
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const suggestion = filteredSuggestions[activeSuggestionIndex] ?? filteredSuggestions[0];
          if (suggestion) {
            applySuggestion(suggestion);
          }
          return;
        }
      }

      if (
        enableAutocomplete &&
        (event.metaKey || event.ctrlKey) &&
        (AUTOCOMPLETE_TRIGGER_KEYS.has(event.code) || AUTOCOMPLETE_TRIGGER_KEYS.has(event.key))
      ) {
        event.preventDefault();
        setShowAllSuggestions(true);
        return;
      }

      if (event.key === "Tab") {
        const moved = focusAdjacentField(event.shiftKey ? -1 : 1);
        if (moved) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }
    };
  }, [activeSuggestionIndex, applySuggestion, enableAutocomplete, filteredSuggestions, focusAdjacentField, handleToolbarAction, readOnly, shouldShowAutocomplete]);

  useEffect(() => {
    if (!textareaNode) {
      return;
    }

    const listener = (event: KeyboardEvent) => {
      keydownHandlerRef.current?.(event);
    };

    const keydownOptions: AddEventListenerOptions = { capture: true };
    textareaNode.addEventListener("keydown", listener, keydownOptions);
    return () => {
      textareaNode.removeEventListener("keydown", listener, keydownOptions);
    };
  }, [textareaNode]);

  const editorClassName = [
    "bn-step-editor",
    multiline ? "bn-step-editor--multiline" : "",
    isFocused ? "bn-step-editor--focused" : "",
    readOnly ? "bn-step-editor--readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inputClassName = [
    "bn-step-field__input",
    multiline ? "bn-step-field__input--multiline" : "",
    isFocused ? "bn-step-field__input--focused" : "",
    readOnly ? "bn-step-field__input--readonly" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const showToolbar =
    showFormattingButtons || (enableImageUpload && uploadImage && showImageButton) || Boolean(rightAction) || enableAutocomplete;

  return (
    <div className="bn-step-field">
      {showLabel && (
        <div className="bn-step-field__top">
          <div className="bn-step-field__label-row">
            {labelToggle ? (
              <span
                className="bn-step-field__label bn-step-field__label--toggle"
                role="button"
                tabIndex={-1}
                onClick={labelToggle.onClick}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    labelToggle.onClick();
                  }
                }}
                aria-expanded={labelToggle.expanded}
              >
                {label}
              </span>
            ) : (
              <span className="bn-step-field__label">{label}</span>
            )}
          </div>
          {labelAction && <div className="bn-step-field__label-action">{labelAction}</div>}
        </div>
      )}
      <div className={inputClassName} aria-label={`${label} input`}>
        <div
          ref={editorContainerRef}
          className={editorClassName}
          data-step-field={fieldName}
          tabIndex={-1}
          onFocus={(event) => {
            if (event.target === editorContainerRef.current) {
              if (textareaNode) {
                textareaNode.focus();
              } else {
                pendingFocusRef.current = true;
              }
            }
          }}
        />
        {cursorLink && isFocused && (
          <div className="bn-step-link-tooltip">
            <span className="bn-step-link-tooltip__url" title={cursorLink.url}>
              {cursorLink.url.length > 40 ? `${cursorLink.url.slice(0, 40)}...` : cursorLink.url}
            </span>
            <button
              type="button"
              className="bn-step-link-tooltip__btn"
              onMouseDown={(event) => {
                event.preventDefault();
                linkSelectionRef.current = { start: cursorLink.start, end: cursorLink.end, text: "" };
                setShowLinkPopover(true);
              }}
              tabIndex={-1}
            >
              Edit link
            </button>
            <a
              className="bn-step-link-tooltip__btn"
              href={cursorLink.url}
              target="_blank"
              rel="noopener noreferrer"
              onMouseDown={(event) => event.stopPropagation()}
              tabIndex={-1}
            >
              <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
            <button
              type="button"
              className="bn-step-link-tooltip__btn bn-step-link-tooltip__btn--danger"
              onMouseDown={(event) => {
                event.preventDefault();
                handleRemoveLink();
              }}
              tabIndex={-1}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M7 3h2a1 1 0 0 0-2 0ZM6 3a2 2 0 1 1 4 0h4a.5.5 0 0 1 0 1h-.564l-1.205 8.838A2.5 2.5 0 0 1 9.754 15H6.246a2.5 2.5 0 0 1-2.477-2.162L2.564 4H2a.5.5 0 0 1 0-1h4Zm1 3.5a.5.5 0 0 0-1 0v5a.5.5 0 0 0 1 0v-5ZM9.5 6a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 1 0v-5a.5.5 0 0 0-.5-.5Z" />
              </svg>
            </button>
          </div>
        )}
        {showToolbar && (
          <div className="bn-step-toolbar" aria-label={`${label} controls`}>
            {showFormattingButtons && (
              <>
                <button
                  type="button"
                  className={`bn-step-toolbar__button${activeFormats.has("bold") ? " bn-step-toolbar__button--active" : ""}`}
                  data-tooltip="Bold"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleToolbarAction("toggleBold");
                  }}
                  aria-label="Bold"
                  tabIndex={-1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 2.66675H8.33333C8.92064 2.66677 9.49502 2.83918 9.98525 3.1626C10.4755 3.48602 10.86 3.94622 11.0911 4.48613C11.3223 5.02604 11.3898 5.62192 11.2855 6.19988C11.1811 6.77783 10.9094 7.31244 10.504 7.73741C11.0752 8.06825 11.5213 8.57823 11.7733 9.18833C12.0252 9.79844 12.0689 10.4746 11.8976 11.1121C11.7263 11.7495 11.3495 12.3127 10.8256 12.7143C10.3018 13.1159 9.66008 13.3335 9 13.3334H4V12.0001H4.66667V4.00008H4V2.66675ZM6 7.33341H8.33333C8.77536 7.33341 9.19928 7.15782 9.51184 6.84526C9.8244 6.5327 10 6.10878 10 5.66675C10 5.22472 9.8244 4.8008 9.51184 4.48824C9.19928 4.17568 8.77536 4.00008 8.33333 4.00008H6V7.33341ZM6 8.66675V12.0001H9C9.44203 12.0001 9.86595 11.8245 10.1785 11.5119C10.4911 11.1994 10.6667 10.7754 10.6667 10.3334C10.6667 9.89139 10.4911 9.46746 10.1785 9.1549C9.86595 8.84234 9.44203 8.66675 9 8.66675H6Z" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className={`bn-step-toolbar__button${activeFormats.has("italic") ? " bn-step-toolbar__button--active" : ""}`}
                  data-tooltip="Italic"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleToolbarAction("toggleItalic");
                  }}
                  aria-label="Italic"
                  tabIndex={-1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8.66699 13.3334H4.66699V12.0001H5.95166L8.69566 4.00008H7.33366V2.66675H11.3337V4.00008H10.049L7.30499 12.0001H8.66699V13.3334Z" fill="currentColor"/>
                  </svg>
                </button>
                <button
                  type="button"
                  className={`bn-step-toolbar__button${activeFormats.has("code") ? " bn-step-toolbar__button--active" : ""}`}
                  data-tooltip="Code"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleToolbarAction("toggleCode");
                  }}
                  aria-label="Code"
                  tabIndex={-1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M10.333 12.6667L14 8.00008L10.333 3.33341L9.15833 4.28341L12.1583 8.00008L9.15833 11.7167L10.333 12.6667ZM5.66699 12.6667L6.84166 11.7167L3.84166 8.00008L6.84166 4.28341L5.66699 3.33341L2 8.00008L5.66699 12.6667Z" fill="currentColor"/>
                  </svg>
                </button>
              </>
            )}
            {enableImageUpload && uploadImage && showImageButton && (
              <button
                type="button"
                className="bn-step-toolbar__button"
                data-tooltip="Insert image"
                onMouseDown={(event) => {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }}
              aria-label="Insert image"
              tabIndex={-1}
              disabled={isUploading}
            >
              <ImageUploadIcon />
            </button>
          )}
            {showFormattingButtons && Components && (
              <Components.Generic.Popover.Root
                opened={showLinkPopover}
                position="top"
              >
                <Components.Generic.Popover.Trigger>
                  <button
                    type="button"
                    className={`bn-step-toolbar__button${linkActive ? " bn-step-toolbar__button--active" : ""}`}
                    data-tooltip="Insert link"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      if (showLinkPopover) {
                        setShowLinkPopover(false);
                        linkSelectionRef.current = null;
                      } else {
                        handleOpenLinkPopover();
                      }
                    }}
                    aria-label="Insert link"
                    tabIndex={-1}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M6.66699 4.66699C6.85574 4.66707 7.0139 4.73069 7.1416 4.8584C7.26931 4.9861 7.33293 5.14426 7.33301 5.33301C7.33301 5.5219 7.26938 5.68082 7.1416 5.80859C7.01393 5.93619 6.85566 5.99993 6.66699 6H4.66699C4.11151 6 3.63886 6.19423 3.25 6.58301C2.86111 6.9719 2.66699 7.44444 2.66699 8C2.66699 8.55556 2.86111 9.0281 3.25 9.41699C3.63886 9.80577 4.11151 10 4.66699 10H6.66699C6.85566 10.0001 7.01393 10.0638 7.1416 10.1914C7.26938 10.3192 7.33301 10.4781 7.33301 10.667C7.33293 10.8557 7.26931 11.0139 7.1416 11.1416C7.0139 11.2693 6.85574 11.3329 6.66699 11.333H4.66699C3.74485 11.333 2.95856 11.0083 2.30859 10.3584C1.65859 9.7084 1.33301 8.92222 1.33301 8C1.33301 7.07778 1.65859 6.2916 2.30859 5.6416C2.95856 4.99171 3.74485 4.66699 4.66699 4.66699H6.66699ZM11.333 4.66699C12.2552 4.66699 13.0414 4.99171 13.6914 5.6416C14.3414 6.2916 14.667 7.07778 14.667 8C14.667 8.92222 14.3414 9.7084 13.6914 10.3584C13.0414 11.0083 12.2552 11.333 11.333 11.333H9.33301C9.14426 11.3329 8.9861 11.2693 8.8584 11.1416C8.73069 11.0139 8.66707 10.8557 8.66699 10.667C8.66699 10.4781 8.73062 10.3192 8.8584 10.1914C8.98607 10.0638 9.14434 10.0001 9.33301 10H11.333C11.8885 10 12.3611 9.80577 12.75 9.41699C13.1389 9.0281 13.333 8.55556 13.333 8C13.333 7.44444 13.1389 6.9719 12.75 6.58301C12.3611 6.19423 11.8885 6 11.333 6H9.33301C9.14434 5.99993 8.98607 5.93619 8.8584 5.80859C8.73062 5.68082 8.66699 5.5219 8.66699 5.33301C8.66707 5.14426 8.73069 4.9861 8.8584 4.8584C8.9861 4.73069 9.14426 4.66707 9.33301 4.66699H11.333ZM10 7.33301C10.1889 7.33301 10.3468 7.39761 10.4746 7.52539C10.6024 7.65317 10.667 7.81111 10.667 8C10.667 8.18889 10.6024 8.34683 10.4746 8.47461C10.3468 8.60239 10.1889 8.66699 10 8.66699H6C5.81111 8.66699 5.65317 8.60239 5.52539 8.47461C5.39761 8.34683 5.33301 8.18889 5.33301 8C5.33301 7.81111 5.39761 7.65317 5.52539 7.52539C5.65317 7.39761 5.81111 7.33301 6 7.33301H10Z" fill="currentColor"/>
                    </svg>
                  </button>
                </Components.Generic.Popover.Trigger>
                <Components.Generic.Popover.Content
                  className="bn-popover-content bn-form-popover"
                  variant="form-popover"
                >
                  <div ref={linkPopoverRef}>
                    <EditLinkMenuItems
                      url={(() => {
                        const sel = linkSelectionRef.current;
                        if (!sel) return "";
                        const existing = linksRef.current.find((l) => l.start < sel.end && l.end > sel.start);
                        return existing?.url ?? "";
                      })()}
                      text={linkSelectionRef.current?.text ?? ""}
                      editLink={handleEditLink}
                    />
                  </div>
                </Components.Generic.Popover.Content>
              </Components.Generic.Popover.Root>
            )}
            {enableAutocomplete && (
              <>
                <div className="bn-step-toolbar__divider" />
                <button
                  type="button"
                  className="bn-step-toolbar__button"
                  data-tooltip="Show suggestions"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setShowAllSuggestions(true);
                    textareaNode?.focus();
                  }}
                  aria-label="Show suggestions"
                  tabIndex={-1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M12 10.667H14V12H12V14H10.667V12H8.66699V10.667H10.667V8.66699H12V10.667ZM12 1.33301C12.74 1.33301 13.333 1.92699 13.333 2.66699V7.86621C12.9265 7.63301 12.4798 7.46669 12 7.38672V2.66699H2.66699V12H7.38672C7.46669 12.4798 7.63301 12.9265 7.86621 13.333H2.66699C1.92699 13.333 1.33301 12.74 1.33301 12V2.66699C1.33301 1.92699 1.92699 1.33301 2.66699 1.33301H12ZM7.33301 10.667H4V9.33301H7.33301V10.667ZM10.667 7.38672C10.1004 7.48005 9.5801 7.69336 9.12012 8H4V6.66699H10.667V7.38672ZM10.667 5.33301H4V4H10.667V5.33301Z" fill="currentColor"/>
                  </svg>
                </button>
              </>
            )}
            {rightAction}
          </div>
        )}
      </div>
      {enableImageUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file || !uploadImage) {
              return;
            }
            try {
              setIsUploading(true);
              const response = await uploadImage(file);
              if (response?.url) {
                insertImageMarkdown(response.url);
              }
            } catch (error) {
              console.error("Failed to upload image", error);
            } finally {
              setIsUploading(false);
              event.target.value = "";
            }
          }}
        />
      )}
      {extractedImages.length > 0 && (
        <div className="bn-step-images" role="list">
          {extractedImages.map((image) => (
            <div key={image.id} className="bn-step-image-thumb" role="listitem">
              <button
                type="button"
                className="bn-step-image-thumb__button"
                onClick={() => handleImageClick(image.url)}
                aria-label="Preview image"
              >
                <img src={image.url} alt={image.alt || "Step image"} />
              </button>
              <button
                type="button"
                className="bn-step-image-thumb__remove"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveImage(image);
                }}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {shouldShowAutocomplete && (
        <div className="bn-step-suggestions" role="listbox" aria-label={`${label} suggestions`}>
          {filteredSuggestions.map((suggestion, index) => (
            <button
              type="button"
              key={suggestion.id}
              role="option"
              aria-selected={index === activeSuggestionIndex}
              className={
                index === activeSuggestionIndex
                  ? "bn-step-suggestion bn-step-suggestion--active"
                  : "bn-step-suggestion"
              }
              onMouseDown={(event) => {
                event.preventDefault();
                applySuggestion(suggestion);
              }}
              tabIndex={-1}
            >
              <span className="bn-step-suggestion__title">{suggestion.title}</span>
              {typeof suggestion.usageCount === "number" && suggestion.usageCount > 0 && (
                <span className="bn-step-suggestion__meta">{suggestion.usageCount} uses</span>
              )}
            </button>
          ))}
        </div>
      )}
      {previewImageUrl && (
        <div
          className="bn-step-image-preview"
          role="dialog"
          aria-label="Image preview"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="bn-step-image-preview__content"
            role="document"
            onClick={(event) => event.stopPropagation()}
          >
            <img src={previewImageUrl} alt="Full size step" />
            <button
              type="button"
              className="bn-step-image-preview__close"
              onClick={() => setPreviewImageUrl(null)}
              aria-label="Close preview"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

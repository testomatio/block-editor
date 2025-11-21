import { useStepAutocomplete, type StepSuggestion } from "../stepAutocomplete";
import { type SnippetSuggestion } from "../snippetAutocomplete";
import { useStepImageUpload } from "../stepImageUpload";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, ReactNode, ChangeEvent } from "react";
import {
  escapeHtml,
  escapeMarkdownText,
  htmlToMarkdown,
  markdownToHtml,
  normalizePlainText,
} from "./markdown";

type Suggestion = StepSuggestion | SnippetSuggestion;

type StepFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (nextValue: string) => void;
  autoFocus?: boolean;
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

export function StepField({
  label,
  value,
  placeholder,
  onChange,
  autoFocus,
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
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const autoFocusRef = useRef(false);
  const [plainTextValue, setPlainTextValue] = useState("");
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const stepSuggestions = useStepAutocomplete();
  const suggestions = suggestionsOverride ?? stepSuggestions;
  const uploadImage = useStepImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const normalizedQuery = normalizePlainText(plainTextValue);
  const suggestionPool = useMemo(() => {
    if (!suggestionFilter) {
      return suggestions;
    }
    const filtered = suggestions.filter(suggestionFilter);
    return filtered.length > 0 ? filtered : suggestions;
  }, [suggestionFilter, suggestions]);
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

  useEffect(() => {
    if (normalizedQuery.length > 0) {
      setShowAllSuggestions(false);
    }
  }, [normalizedQuery]);

  useEffect(() => {
    const element = editorRef.current;
    if (!element || isFocused) {
      return;
    }

    if (value.trim().length === 0) {
      element.innerHTML = "";
      setPlainTextValue("");
    } else {
      element.innerHTML = markdownToHtml(value);
      setPlainTextValue(element.textContent ?? "");
    }
  }, [value, isFocused]);

  const syncValue = useCallback(() => {
    const element = editorRef.current;
    if (!element) {
      return;
    }

    const markdown = htmlToMarkdown(element.innerHTML);
    if (markdown !== value) {
      onChange(markdown);
    }
    setPlainTextValue(element.innerText ?? "");
    if (!markdown && element.innerHTML !== "") {
      element.innerHTML = "";
    }
  }, [onChange, value]);

  useEffect(() => {
    if (!autoFocus || autoFocusRef.current || !editorRef.current) {
      return;
    }

    autoFocusRef.current = true;
    const element = editorRef.current;
    const focusElement = () => {
      element.focus();
      setIsFocused(true);
      if (showSuggestionsOnFocus && enableAutocomplete) {
        setShowAllSuggestions(true);
      }
      const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
      if (selection) {
        selection.selectAllChildren(element);
        selection.collapseToEnd();
      }
    };

    if (typeof requestAnimationFrame === "function") {
      const frame = requestAnimationFrame(focusElement);
      return () => cancelAnimationFrame(frame);
    }

    const timeout = setTimeout(focusElement, 0);
    return () => clearTimeout(timeout);
  }, [autoFocus, enableAutocomplete, showSuggestionsOnFocus]);

  const ensureCaretInEditor = useCallback(() => {
    const element = editorRef.current;
    if (!element) {
      return false;
    }

    const selection = window.getSelection?.();
    if (!selection) {
      return false;
    }

    if (selection.rangeCount === 0 || !element.contains(selection.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    element.focus();
    return true;
  }, []);

  const handlePaste = useCallback(
    async (event: ClipboardEvent<HTMLDivElement>) => {
      if ((enableImageUpload && uploadImage) || onImageFile) {
        const items = Array.from(event.clipboardData.items ?? []);
        const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
        const file = imageItem?.getAsFile();
        if (file) {
          event.preventDefault();
          if (onImageFile) {
            await onImageFile(file);
            return;
          }
          if (enableImageUpload && uploadImage) {
            try {
              const result = await uploadImage(file);
              if (result?.url) {
                ensureCaretInEditor();
                const needsBreak = (editorRef.current?.innerHTML ?? "").trim().length > 0;
                const imgHtml =
                  (needsBreak ? "<br />" : "") +
                  `<img src="${escapeHtml(result.url)}" alt="" class="bn-inline-image" contenteditable="false" draggable="false" />`;
                document.execCommand("insertHTML", false, imgHtml);
                syncValue();
              }
            } catch (error) {
              console.error("Failed to upload image from paste", error);
            }
            return;
          }
        }
      }

      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const html = markdownToHtml(text);
      ensureCaretInEditor();
      document.execCommand("insertHTML", false, html);
      syncValue();
    },
    [enableImageUpload, ensureCaretInEditor, onImageFile, syncValue, uploadImage],
  );

  const applySuggestion = useCallback(
    (suggestion: Suggestion) => {
      const escaped = escapeMarkdownText(suggestion.title);
      onChange(escaped);
      onSuggestionSelect?.(suggestion);
      setPlainTextValue(suggestion.title);
      setActiveSuggestionIndex(0);
      setShowAllSuggestions(false);
      if (editorRef.current) {
        editorRef.current.innerHTML = markdownToHtml(escaped);
        editorRef.current.focus();
        const selection = typeof window !== "undefined" ? window.getSelection?.() : null;
        if (selection && editorRef.current.firstChild) {
          const range = document.createRange();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    },
    [onChange, onSuggestionSelect],
  );

  return (
    <div className="bn-step-field">
      <div className="bn-step-field__top">
        <span className="bn-step-field__label">
          {label}
          {enableAutocomplete && (
            <button
              type="button"
              className="bn-step-toolbar__button"
              onMouseDown={(event) => {
                event.preventDefault();
                setShowAllSuggestions(true);
                editorRef.current?.focus();
              }}
              aria-label="Show suggestions"
              tabIndex={-1}
            >
              ⌄
            </button>
          )}
        </span>
        <div className="bn-step-toolbar" aria-label={`${label} controls`}>
          {showFormattingButtons && (
            <>
              <button
                type="button"
                className="bn-step-toolbar__button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  editorRef.current?.focus();
                  document.execCommand("bold");
                  syncValue();
                }}
                aria-label="Bold"
                tabIndex={-1}
              >
                B
              </button>
              <button
                type="button"
                className="bn-step-toolbar__button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  editorRef.current?.focus();
                  document.execCommand("italic");
                  syncValue();
                }}
                aria-label="Italic"
                tabIndex={-1}
              >
                I
              </button>
            </>
          )}
          {enableImageUpload && uploadImage && showImageButton && (
            <button
              type="button"
              className="bn-step-toolbar__button"
              onMouseDown={(event) => {
                event.preventDefault();
                const input = fileInputRef.current;
                if (input) {
                  input.click();
                }
              }}
              aria-label="Insert image"
              tabIndex={-1}
              disabled={isUploading}
            >
              Img
            </button>
          )}
          {rightAction}
        </div>
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
                const element = editorRef.current;
                if (element) {
                  const escapedUrl = escapeHtml(response.url);
                  const needsBreak = element.innerHTML.trim().length > 0;
                  const imgHtml =
                    (needsBreak ? "<br />" : "") +
                    `<img src="${escapedUrl}" alt="" class="bn-inline-image" contenteditable="false" draggable="false" />`;
                  element.focus();
                  ensureCaretInEditor();
                  document.execCommand("insertHTML", false, imgHtml);
                  syncValue();
                }
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
      <div
        ref={editorRef}
        className="bn-step-editor"
        suppressContentEditableWarning
        data-placeholder={placeholder}
        data-multiline={multiline ? "true" : "false"}
        data-step-field={fieldName}
        contentEditable={readOnly ? "false" : "true"}
        onFocus={() => {
          setIsFocused(true);
          if (showSuggestionsOnFocus && enableAutocomplete) {
            setShowAllSuggestions(true);
          }
          onFieldFocus?.();
          setPlainTextValue(editorRef.current?.innerText ?? "");
        }}
        onBlur={() => {
          setIsFocused(false);
          syncValue();
        }}
        onInput={readOnly ? undefined : syncValue}
        onPaste={readOnly ? (event) => event.preventDefault() : handlePaste}
        onKeyDown={(event) => {
          if (readOnly) {
            const allowedKeys = new Set([
              "ArrowDown",
              "ArrowUp",
              "Enter",
              "Tab",
            ]);
            const openKeys =
              enableAutocomplete && (event.metaKey || event.ctrlKey) && (event.code === "Space" || event.key === "" || event.key === " ");
            if (!allowedKeys.has(event.key) && !openKeys) {
              event.preventDefault();
              return;
            }
          }
          if ((event.key === "a" || event.key === "A") && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            const selection = window.getSelection?.();
            const node = editorRef.current;
            if (selection && node) {
              const range = document.createRange();
              range.selectNodeContents(node);
              selection.removeAllRanges();
              selection.addRange(range);
            }
            return;
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

          if (enableAutocomplete && (event.metaKey || event.ctrlKey) && (event.code === "Space" || event.key === "" || event.key === " ")) {
            event.preventDefault();
            setShowAllSuggestions(true);
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            if (multiline && event.shiftKey) {
              document.execCommand("insertLineBreak");
              document.execCommand("insertLineBreak");
            } else {
              document.execCommand("insertLineBreak");
            }
            syncValue();
          }
        }}
      />
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
    </div>
  );
}

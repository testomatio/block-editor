import OverType, { type OverType as OverTypeInstance } from "overtype";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { useStepAutocomplete, type StepSuggestion } from "../stepAutocomplete";
import { type SnippetSuggestion } from "../snippetAutocomplete";
import { useStepImageUpload } from "../stepImageUpload";
import { escapeMarkdownText, normalizePlainText } from "./markdown";
import { useAutoResize } from "./useAutoResize";

type Suggestion = StepSuggestion | SnippetSuggestion;

type StepFieldProps = {
  label: string;
  labelButton?: {
    text: string;
    onClick: () => void;
    expanded: boolean;
  };
  value: string;
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

const READ_ONLY_ALLOWED_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "Enter",
  "Tab",
]);

const AUTOCOMPLETE_TRIGGER_KEYS = new Set([" ", "Space"]);

const markdownParser = (OverType as { MarkdownParser?: { parse: (markdown: string) => string } }).MarkdownParser;

type ExtractedImage = {
  id: string;
  url: string;
  alt: string;
  start: number;
  end: number;
  markdown: string;
};

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
  labelButton,
  value,
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

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const handleEditorChange = useCallback((nextValue: string) => {
    setPlainTextValue((prev) => {
      const normalized = markdownToPlainText(nextValue);
      return prev === normalized ? prev : normalized;
    });
    onChangeRef.current?.(nextValue);
  }, []);

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) {
      return;
    }

    const [instance] = OverType.init(container, {
      value: initialValueRef.current,
      autoResize: multiline,
      minHeight: multiline ? "4rem" : "2.5rem",
      padding: "0.5rem 0.75rem",
      fontSize: "0.95rem",
      onChange: handleEditorChange,
    });

    editorInstanceRef.current = instance;
    setTextareaNode(instance.textarea);

    return () => {
      instance.destroy();
      editorInstanceRef.current = null;
      setTextareaNode(null);
    };
  }, [handleEditorChange, multiline]);

  useEffect(() => {
    if (pendingFocusRef.current && textareaNode) {
      pendingFocusRef.current = false;
      textareaNode.focus();
    }
  }, [textareaNode]);

  useEffect(() => {
    const instance = editorInstanceRef.current;
    if (!instance) {
      setPlainTextValue((prev) => {
        const normalized = markdownToPlainText(value);
        return prev === normalized ? prev : normalized;
      });
      return;
    }

    if (instance.getValue() !== value) {
      instance.setValue(value);
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

      instance.setValue(nextValue);
      setPlainTextValue(markdownToPlainText(nextValue));
      onChangeRef.current?.(nextValue);

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
    (action: "toggleBold" | "toggleItalic") => {
      const shortcuts = editorInstanceRef.current?.shortcuts;
      if (!textareaNode || !shortcuts?.handleAction) {
        return;
      }
      textareaNode.focus();
      shortcuts.handleAction(action);
    },
    [textareaNode],
  );

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
  }, [activeSuggestionIndex, applySuggestion, enableAutocomplete, filteredSuggestions, focusAdjacentField, readOnly, shouldShowAutocomplete]);

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

  return (
    <div className="bn-step-field">
      <div className="bn-step-field__top">
        {labelButton ? (
          <button
            type="button"
            className="bn-step-field__label bn-step-field__label--link"
            onClick={labelButton.onClick}
            aria-expanded={labelButton.expanded}
          >
            {labelButton.text}
          </button>
        ) : (
          <span className="bn-step-field__label">{label}</span>
        )}
        {enableAutocomplete && (
            <button
              type="button"
              className="bn-step-toolbar__button"
              onMouseDown={(event) => {
                event.preventDefault();
                setShowAllSuggestions(true);
                textareaNode?.focus();
              }}
              aria-label="Show suggestions"
              tabIndex={-1}
            >
              ⌄
            </button>
        )}
        <div className="bn-step-toolbar" aria-label={`${label} controls`}>
          {showFormattingButtons && (
            <>
              <button
                type="button"
                className="bn-step-toolbar__button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleToolbarAction("toggleBold");
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
                  handleToolbarAction("toggleItalic");
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
                fileInputRef.current?.click();
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

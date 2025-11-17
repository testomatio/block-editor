import { defaultBlockSpecs, defaultProps } from "@blocknote/core";
import { BlockNoteSchema } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, CSSProperties } from "react";
import { useStepAutocomplete, type StepSuggestion } from "./stepAutocomplete";
import { useStepImageUpload } from "./stepImageUpload";

type InlineSegment = {
  text: string;
  styles: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
  };
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const IMAGE_MARKDOWN_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
function markdownToHtml(markdown: string): string {
  if (!markdown) {
    return "";
  }

  const lines = markdown.split(/\n/);
  const htmlLines = lines.map((line) => {
    const inline = parseInlineMarkdown(line);
    const html = inlineToHtml(inline);
    if (!html) {
      return html;
    }

    return html.replace(
      IMAGE_MARKDOWN_REGEX,
      (_match, alt = "", src = "") =>
        `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="bn-inline-image" contenteditable="false" draggable="false" />`,
    );
  });
  return htmlLines.join("<br />");
}

function parseInlineMarkdown(text: string): InlineSegment[] {
  if (!text) {
    return [];
  }

  const normalized = text.replace(/\\([*_`~])/g, "\uE000$1");
  const rawSegments = normalized
    .split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|<u>[^<]+<\/u>)/)
    .filter(Boolean);

  return rawSegments.map((segment) => {
    const baseStyles = { bold: false, italic: false, underline: false };

    if (/^\*\*(.+)\*\*$/.test(segment) || /^__(.+)__$/.test(segment)) {
      const content = segment.slice(2, -2);
      return {
        text: restoreEscapes(content),
        styles: { ...baseStyles, bold: true },
      };
    }

    if (/^\*(.+)\*$/.test(segment) || /^_(.+)_$/.test(segment)) {
      const content = segment.slice(1, -1);
      return {
        text: restoreEscapes(content),
        styles: { ...baseStyles, italic: true },
      };
    }

    if (/^<u>(.+)<\/u>$/.test(segment)) {
      const content = segment.slice(3, -4);
      return {
        text: restoreEscapes(content),
        styles: { ...baseStyles, underline: true },
      };
    }

    return {
      text: restoreEscapes(segment),
      styles: { ...baseStyles },
    };
  });
}

function inlineToHtml(inline: InlineSegment[]): string {
  return inline
    .map(({ text, styles }) => {
      let html = escapeHtml(text);
      if (styles.bold) {
        html = `<strong>${html}</strong>`;
      }
      if (styles.italic) {
        html = `<em>${html}</em>`;
      }
      if (styles.underline) {
        html = `<u>${html}</u>`;
      }
      return html;
    })
    .join("");
}

function restoreEscapes(text: string): string {
  return text.replace(/\uE000/g, "\\");
}

function htmlToMarkdown(html: string): string {
  if (typeof document === "undefined") {
    return fallbackHtmlToMarkdown(html);
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;

  const traverse = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      return escapeMarkdownText(text);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    const children = Array.from(element.childNodes)
      .map(traverse)
      .join("");

    switch (element.tagName.toLowerCase()) {
      case "strong":
      case "b":
        return children ? `**${children}**` : children;
      case "em":
      case "i":
        return children ? `*${children}*` : children;
      case "u":
        return children ? `<u>${children}</u>` : children;
      case "br":
        return "\n";
      case "div":
      case "p":
        return children + "\n";
      case "img": {
        const src = element.getAttribute("src") ?? "";
        const alt = element.getAttribute("alt") ?? "";
        return `![${alt}](${src})`;
      }
      default:
        return children;
    }
  };

  const markdown = Array.from(temp.childNodes).map(traverse).join("");
  return markdown.replace(/\n{3,}/g, "\n\n").trim();
}

function fallbackHtmlToMarkdown(html: string): string {
  if (!html) {
    return "";
  }

  let result = html;

  result = result.replace(/<img[^>]*>/gi, (match) => {
    const src = match.match(/src="([^"]*)"/i)?.[1] ?? "";
    const alt = match.match(/alt="([^"]*)"/i)?.[1] ?? "";
    return `![${alt}](${src})`;
  });

  result = result
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(div|p)>/gi, "\n")
    .replace(/<strong>(.*?)<\/strong>/gis, (_m, content) => `**${content}**`)
    .replace(/<(em|i)>(.*?)<\/(em|i)>/gis, (_m, _tag, content) => `*${content}*`)
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<u>(.*?)<\/u>/gis, (_m, content) => `<u>${content}</u>`);

  result = result.replace(/<\/?[^>]+>/g, "");

  return result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MARKDOWN_ESCAPE_REGEX = /([*_\\])/g;

function escapeMarkdownText(text: string): string {
  return text.replace(MARKDOWN_ESCAPE_REGEX, "\\$1");
}

function normalizePlainText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

type StepFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (nextValue: string) => void;
  autoFocus?: boolean;
  multiline?: boolean;
  enableAutocomplete?: boolean;
  fieldName?: string;
  enableImageUpload?: boolean;
  onImageFile?: (file: File) => Promise<void> | void;
};

function StepField({
  label,
  value,
  placeholder,
  onChange,
  autoFocus,
  multiline = false,
  enableAutocomplete = false,
  fieldName,
  enableImageUpload = false,
  onImageFile,
}: StepFieldProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const autoFocusRef = useRef(false);
  const [plainTextValue, setPlainTextValue] = useState("");
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const suggestions = useStepAutocomplete();
  const uploadImage = useStepImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const normalizedQuery = normalizePlainText(plainTextValue);
  const filteredSuggestions = useMemo(() => {
    if (!enableAutocomplete) {
      return [];
    }

    const pool = showAllSuggestions || !normalizedQuery
      ? suggestions
      : suggestions.filter((item) => normalizePlainText(item.title).startsWith(normalizedQuery));

    return pool.slice(0, 8);
  }, [enableAutocomplete, normalizedQuery, showAllSuggestions, suggestions]);
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
  }, [autoFocus]);

  const applyFormat = useCallback(
    (command: "bold" | "italic" | "underline") => {
      document.execCommand(command);
      syncValue();
    },
    [syncValue],
  );

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

  const insertImageAtCursor = useCallback(
    (url: string) => {
      const element = editorRef.current;
      if (!element) {
        return;
      }

      const escapedUrl = escapeHtml(url);
      const imgHtml = `<img src="${escapedUrl}" alt="" class="bn-inline-image" contenteditable="false" draggable="false" />`;
      element.focus();
      ensureCaretInEditor();
      document.execCommand("insertHTML", false, imgHtml);
      syncValue();
    },
    [ensureCaretInEditor, syncValue],
  );

  const handleImagePick = useCallback(async () => {
    if (!enableImageUpload || !uploadImage) {
      return;
    }

    const fileInput = fileInputRef.current;
    if (fileInput) {
      fileInput.click();
    }
  }, [enableImageUpload, uploadImage]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !uploadImage) {
        return;
      }

      try {
        setIsUploading(true);
        const response = await uploadImage(file);
        if (response?.url) {
          insertImageAtCursor(response.url);
        }
      } catch (error) {
        console.error("Failed to upload image", error);
      } finally {
        setIsUploading(false);
        event.target.value = "";
      }
    },
    [insertImageAtCursor, uploadImage],
  );

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
              setIsUploading(true);
              const result = await uploadImage(file);
              if (result?.url) {
                ensureCaretInEditor();
                document.execCommand(
                  "insertHTML",
                  false,
                  `<img src="${escapeHtml(result.url)}" alt="" class="bn-inline-image" contenteditable="false" draggable="false" />`,
                );
                syncValue();
              }
            } catch (error) {
              console.error("Failed to upload image from paste", error);
            } finally {
              setIsUploading(false);
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
    [enableImageUpload, ensureCaretInEditor, syncValue, uploadImage],
  );

  const applySuggestion = useCallback(
    (suggestion: StepSuggestion) => {
      const escaped = escapeMarkdownText(suggestion.title);
      onChange(escaped);
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
    [onChange],
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
              aria-label="Show step suggestions"
              tabIndex={-1}
            >
              ⌄
            </button>
          )}
        </span>
        <div className="bn-step-toolbar" aria-label={`${label} formatting`}>
          <button
            type="button"
            className="bn-step-toolbar__button"
            onMouseDown={(event) => {
              event.preventDefault();
              editorRef.current?.focus();
              applyFormat("bold");
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
              applyFormat("italic");
            }}
            aria-label="Italic"
            tabIndex={-1}
          >
            I
          </button>
          <button
            type="button"
            className="bn-step-toolbar__button"
            onMouseDown={(event) => {
              event.preventDefault();
              editorRef.current?.focus();
              applyFormat("underline");
            }}
            aria-label="Underline"
            tabIndex={-1}
          >
            U
          </button>
          {enableImageUpload && uploadImage && (
            <button
              type="button"
              className="bn-step-toolbar__button"
              onMouseDown={(event) => {
                event.preventDefault();
                handleImagePick();
              }}
              aria-label="Insert image"
              tabIndex={-1}
              disabled={isUploading}
            >
              Img
            </button>
          )}
        </div>
      </div>
      {enableImageUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      )}
      <div
        ref={editorRef}
        className="bn-step-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        data-multiline={multiline ? "true" : "false"}
        data-step-field={fieldName}
        onFocus={() => {
          setIsFocused(true);
          setPlainTextValue(editorRef.current?.innerText ?? "");
        }}
        onBlur={() => {
          setIsFocused(false);
          syncValue();
        }}
        onInput={syncValue}
        onPaste={handlePaste}
        onKeyDown={(event) => {
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

const statusOptions = ["draft", "ready", "blocked"] as const;

type Status = (typeof statusOptions)[number];

const statusLabels: Record<Status, string> = {
  draft: "Draft",
  ready: "Ready",
  blocked: "Blocked",
};

const statusClassNames: Record<Status, string> = {
  draft: "bn-testcase--draft",
  ready: "bn-testcase--ready",
  blocked: "bn-testcase--blocked",
};

const testStepBlock = createReactBlockSpec(
  {
    type: "testStep",
    content: "none",
    propSchema: {
      stepTitle: {
        default: "",
      },
      stepData: {
        default: "",
      },
      expectedResult: {
        default: "",
      },
    },
  },
  {
    render: ({ block, editor }) => {
      const stepTitle = (block.props.stepTitle as string) || "";
      const stepData = (block.props.stepData as string) || "";
      const expectedResult = (block.props.expectedResult as string) || "";
      const showExpectedField =
        stepTitle.trim().length > 0 || stepData.trim().length > 0 || expectedResult.trim().length > 0;
      const [isDataVisible, setIsDataVisible] = useState(() => stepData.trim().length > 0);
      const [shouldFocusDataField, setShouldFocusDataField] = useState(false);
      const uploadImage = useStepImageUpload();

      useEffect(() => {
        if (stepData.trim().length > 0 && !isDataVisible) {
          setIsDataVisible(true);
        }
      }, [isDataVisible, stepData]);

      useEffect(() => {
        if (shouldFocusDataField && isDataVisible) {
          const timer = setTimeout(() => setShouldFocusDataField(false), 0);
          return () => clearTimeout(timer);
        }
        return undefined;
      }, [isDataVisible, shouldFocusDataField]);

      const handleStepTitleChange = useCallback(
        (next: string) => {
          if (next === stepTitle) {
            return;
          }

          editor.updateBlock(block.id, {
            props: {
              stepTitle: next,
            },
          });
        },
        [editor, block.id, stepTitle],
      );

      const handleStepDataChange = useCallback(
        (next: string) => {
          if (next === stepData) {
            return;
          }

          editor.updateBlock(block.id, {
            props: {
              stepData: next,
            },
          });
        },
        [editor, block.id, stepData],
      );

      const handleShowDataField = useCallback(() => {
        setIsDataVisible(true);
        setShouldFocusDataField(true);
      }, []);

      const handleExpectedChange = useCallback(
        (next: string) => {
          if (next === expectedResult) {
            return;
          }

          editor.updateBlock(block.id, {
            props: {
              expectedResult: next,
            },
          });
        },
        [editor, block.id, expectedResult],
      );

      return (
        <div className="bn-teststep" data-block-id={block.id}>
          <StepField
            label="Step Title"
            value={stepTitle}
            placeholder="Describe the action to perform"
            onChange={handleStepTitleChange}
            autoFocus={stepTitle.length === 0}
            enableAutocomplete
            fieldName="title"
            enableImageUpload={false}
            onImageFile={async (file) => {
              if (!uploadImage) {
                return;
              }

              setIsDataVisible(true);
              setShouldFocusDataField(true);
              try {
                const result = await uploadImage(file);
                if (result?.url) {
                  const nextValue = stepData.trim().length > 0 ? `${stepData}\n![](${result.url})` : `![](${result.url})`;
                  editor.updateBlock(block.id, {
                    props: {
                      stepData: nextValue,
                    },
                  });
                }
              } catch (error) {
                console.error("Failed to upload image to Step Data", error);
              }
            }}
          />
          {!isDataVisible && (
            <button
              type="button"
              className="bn-teststep__toggle"
              onClick={handleShowDataField}
              aria-expanded="false"
              tabIndex={-1}
            >
              + Step Data
            </button>
          )}
          {isDataVisible && (
            <StepField
              label="Step Data"
              value={stepData}
              placeholder="Provide additional data about the step"
              onChange={handleStepDataChange}
              autoFocus={shouldFocusDataField}
              multiline
              enableImageUpload
            />
          )}
          {showExpectedField && (
            <StepField
              label="Expected Result"
              value={expectedResult}
              placeholder="What should happen?"
              onChange={handleExpectedChange}
              multiline
              enableImageUpload
            />
          )}
        </div>
      );
    },
  },
);

const testCaseBlock = createReactBlockSpec(
  {
    type: "testCase",
    content: "inline",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      backgroundColor: defaultProps.backgroundColor,
      status: {
        default: "draft" as Status,
        values: Array.from(statusOptions),
      },
      reference: {
        default: "",
      },
    },
  },
  {
    render: ({ block, contentRef, editor }) => {
      const status = block.props.status as Status;

      const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const nextStatus = event.target.value as Status;
        editor.updateBlock(block.id, {
          props: {
            status: nextStatus,
          },
        });
      };

      const handleReferenceChange = (event: ChangeEvent<HTMLInputElement>) => {
        editor.updateBlock(block.id, {
          props: {
            reference: event.target.value,
          },
        });
      };

      const style: CSSProperties = {
        textAlign: block.props.textAlignment,
        color:
          block.props.textColor === "default"
            ? undefined
            : (block.props.textColor as string),
        backgroundColor:
          block.props.backgroundColor === "default"
            ? undefined
            : (block.props.backgroundColor as string),
      };

      return (
        <div
          className={"bn-testcase " + statusClassNames[status]}
          data-reference={block.props.reference || undefined}
          style={style}
        >
          <div className="bn-testcase__header">
            <div className="bn-testcase__meta">
              <span className="bn-testcase__label">Test Case</span>
              <input
                className="bn-testcase__reference"
                placeholder="Reference ID"
                value={block.props.reference}
                onChange={handleReferenceChange}
              />
            </div>
            <label className="bn-testcase__status">
              <span>Status:</span>
              <select value={status} onChange={handleStatusChange}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="bn-testcase__body" ref={contentRef} />
        </div>
      );
    },
  },
);

export const customSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    testCase: testCaseBlock,
    testStep: testStepBlock,
  },
});

export type CustomSchema = typeof customSchema;
export type CustomBlock = CustomSchema["Block"];
export type CustomEditor = CustomSchema["BlockNoteEditor"];

export const __markdownTestUtils = {
  markdownToHtml,
  htmlToMarkdown,
};

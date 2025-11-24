import { createReactBlockSpec } from "@blocknote/react";
import OverType, { type OverType as OverTypeInstance } from "overtype";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StepField } from "./stepField";
import { useSnippetAutocomplete, type SnippetSuggestion } from "../snippetAutocomplete";
import type { StepSuggestion } from "../stepAutocomplete";
import { useStepImageUpload } from "../stepImageUpload";

type SnippetDataFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onFieldFocus?: () => void;
  fieldName?: string;
  enableImageUpload?: boolean;
};

function SnippetDataField({
  label,
  value,
  placeholder,
  onChange,
  onFieldFocus,
  fieldName,
  enableImageUpload = false,
}: SnippetDataFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<OverTypeInstance | null>(null);
  const uploadImage = useStepImageUpload();
  const [isFocused, setIsFocused] = useState(false);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const insertImageMarkdown = useCallback(
    (url: string) => {
      const instance = instanceRef.current;
      const textarea = instance?.textarea;
      if (!instance || !textarea) {
        return;
      }

      const currentValue = instance.getValue();
      const selectionStart = textarea.selectionStart ?? currentValue.length;
      const selectionEnd = textarea.selectionEnd ?? currentValue.length;
      const before = currentValue.slice(0, selectionStart);
      const after = currentValue.slice(selectionEnd);
      const needsNewlineBefore = before.length > 0 && !before.endsWith("\n");
      const needsNewlineAfter = after.length > 0 && !after.startsWith("\n");
      const markdown = `${needsNewlineBefore ? "\n" : ""}![](${url})${needsNewlineAfter ? "\n" : ""}`;
      const nextValue = `${before}${markdown}${after}`;

      instance.setValue(nextValue);
      onChangeRef.current?.(nextValue);

      requestAnimationFrame(() => {
        const cursor = selectionStart + markdown.length;
        textarea.selectionStart = cursor;
        textarea.selectionEnd = cursor;
        textarea.focus();
      });
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const [instance] = OverType.init(container, {
      value: initialValueRef.current,
      placeholder,
      autoResize: true,
      minHeight: "5rem",
      toolbar: true,
      onChange: (nextValue) => {
        onChangeRef.current?.(nextValue);
      },
    });

    instanceRef.current = instance;
    const textarea = instance.textarea;
    if (fieldName) {
      textarea.dataset.stepField = fieldName;
    }

    const handleFocus = () => {
      setIsFocused(true);
      onFieldFocus?.();
    };
    const handleBlur = () => setIsFocused(false);

    textarea.addEventListener("focus", handleFocus);
    textarea.addEventListener("blur", handleBlur);

    return () => {
      textarea.removeEventListener("focus", handleFocus);
      textarea.removeEventListener("blur", handleBlur);
      instance.destroy();
      instanceRef.current = null;
    };
  }, [fieldName, onFieldFocus, placeholder]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) {
      return;
    }

    if (instance.getValue() !== value) {
      instance.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (!enableImageUpload || !uploadImage) {
      return;
    }

    const textarea = instanceRef.current?.textarea;
    if (!textarea) {
      return;
    }

    const handlePaste = async (event: ClipboardEvent) => {
      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
      const file = imageItem?.getAsFile();
      if (!file) {
        return;
      }

      event.preventDefault();

      try {
        const response = await uploadImage(file);
        if (response?.url) {
          insertImageMarkdown(response.url);
        }
      } catch (error) {
        console.error("Failed to upload pasted image", error);
      }
    };

    textarea.addEventListener("paste", handlePaste as unknown as EventListener);
    return () => {
      textarea.removeEventListener("paste", handlePaste as unknown as EventListener);
    };
  }, [enableImageUpload, insertImageMarkdown, uploadImage]);

  const editorClassName = useMemo(
    () =>
      [
        "bn-step-editor",
        "bn-step-editor--multiline",
        isFocused ? "bn-step-editor--focused" : "",
      ]
        .filter(Boolean)
        .join(" "),
    [isFocused],
  );

  return (
    <div className="bn-step-field">
      <div className="bn-step-field__top">
        <span className="bn-step-field__label">{label}</span>
      </div>
      <div ref={containerRef} className={editorClassName} data-step-field={fieldName} />
    </div>
  );
}

export const snippetBlock = createReactBlockSpec(
  {
    type: "snippet",
    content: "none",
    propSchema: {
      snippetId: {
        default: "",
      },
      snippetTitle: {
        default: "",
      },
      snippetData: {
        default: "",
      },
      snippetExpectedResult: {
        default: "",
      },
    },
  },
  {
    render: ({ block, editor }) => {
      const snippetTitle = (block.props.snippetTitle as string) || "";
      const snippetData = (block.props.snippetData as string) || "";
      const snippetSuggestions = useSnippetAutocomplete();
      const hasSnippets = snippetSuggestions.length > 0;

      const handleSnippetChange = useCallback(
        (nextTitle: string) => {
          if (nextTitle === snippetTitle) {
            return;
          }

          editor.updateBlock(block.id, {
            props: {
              snippetTitle: nextTitle,
            },
          });
        },
        [block.id, editor, snippetTitle],
      );

      const handleSnippetDataChange = useCallback(
        (next: string) => {
          if (next === snippetData) {
            return;
          }

          editor.updateBlock(block.id, {
            props: {
              snippetData: next,
            },
          });
        },
        [editor, block.id, snippetData],
      );

      const handleSnippetSelect = useCallback(
        (suggestion: SnippetSuggestion | StepSuggestion) => {
          const rawBody = (suggestion as SnippetSuggestion).body ?? "";
          const sanitizedBody = rawBody
            .split(/\r?\n/)
            .filter((line) => !/^<!--\s*(begin|end)\s+snippet/i.test(line.trim()))
            .join("\n");
          editor.updateBlock(block.id, {
            props: {
              snippetId: suggestion.id,
              snippetData: sanitizedBody,
              snippetTitle: suggestion.title,
            },
          });
        },
        [block.id, editor],
      );

      const handleFieldFocus = useCallback(() => {
        editor.setSelection(block.id, block.id);
      }, [editor, block.id]);

      if (!hasSnippets) {
        return (
          <div className="bn-teststep bn-snippet" data-block-id={block.id}>
            <p className="bn-snippet__empty">No snippets in this project.</p>
          </div>
        );
      }

      return (
        <div className="bn-teststep bn-snippet" data-block-id={block.id}>
          <StepField
            label="Snippet Title"
            value={snippetTitle}
            onChange={handleSnippetChange}
            autoFocus={snippetTitle.length === 0}
            enableAutocomplete
            suggestionFilter={(suggestion) => (suggestion as SnippetSuggestion).isSnippet === true}
            suggestionsOverride={snippetSuggestions as unknown as StepSuggestion[]}
            onSuggestionSelect={handleSnippetSelect}
            fieldName="snippet-title"
            showSuggestionsOnFocus
            enableImageUpload={false}
            onFieldFocus={handleFieldFocus}
          />
          <SnippetDataField
            label="Snippet Data"
            value={snippetData}
            onChange={handleSnippetDataChange}
            fieldName="snippet-data"
            enableImageUpload
            onFieldFocus={handleFieldFocus}
          />
        </div>
      );
    },
  },
);

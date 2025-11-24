import { createReactBlockSpec } from "@blocknote/react";
import { useCallback } from "react";
import { StepField } from "./stepField";
import { useSnippetAutocomplete, type SnippetSuggestion } from "../snippetAutocomplete";
import type { StepSuggestion } from "../stepAutocomplete";

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
          <StepField
            label="Snippet Data"
            value={snippetData}
            onChange={handleSnippetDataChange}
            multiline
            fieldName="snippet-data"
            enableImageUpload
            onFieldFocus={handleFieldFocus}
          />
        </div>
      );
    },
  },
);

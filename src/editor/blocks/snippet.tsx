import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useSnippetAutocomplete, type SnippetSuggestion } from "../snippetAutocomplete";

type SnippetDropdownProps = {
  value: string;
  placeholder: string;
  suggestions: SnippetSuggestion[];
  onSelect: (suggestion: SnippetSuggestion) => void;
};

function SnippetDropdown({ value, placeholder, suggestions, onSelect }: SnippetDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const snippets = suggestions.filter((s) => s.isSnippet === true);
    if (!search) return snippets;
    const lower = search.toLowerCase();
    return snippets.filter((s) => s.title.toLowerCase().includes(lower));
  }, [suggestions, search]);

  const handleSearchChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  }, []);

  return (
    <div className="bn-snippet-dropdown" ref={containerRef}>
      <button
        type="button"
        className="bn-snippet-dropdown__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="bn-snippet-dropdown__text">
          {value || placeholder}
        </span>
        <svg className="bn-snippet-dropdown__chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && (
        <div className="bn-snippet-dropdown__panel" role="listbox">
          <div className="bn-snippet-dropdown__search">
            <svg className="bn-snippet-dropdown__search-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z" fill="currentColor"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              className="bn-snippet-dropdown__search-input"
              placeholder="Search"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <div className="bn-snippet-dropdown__list">
            {filtered.map((suggestion) => (
              <button
                type="button"
                key={suggestion.id}
                role="option"
                className="bn-snippet-dropdown__item"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(suggestion);
                  setIsOpen(false);
                }}
                tabIndex={-1}
              >
                {suggestion.title}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="bn-snippet-dropdown__empty">No snippets found</div>
            )}
          </div>
        </div>
      )}
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
      const snippetId = (block.props.snippetId as string) || "";
      const snippetSuggestions = useSnippetAutocomplete();
      const hasSnippets = snippetSuggestions.length > 0;
      const isSnippetSelected = snippetId.length > 0;

      const handleSnippetSelect = useCallback(
        (suggestion: SnippetSuggestion) => {
          const rawBody = suggestion.body ?? "";
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
        <div className="bn-teststep bn-snippet" data-block-id={block.id} onFocus={handleFieldFocus}>
          <div className="bn-snippet__header">
            <span className="bn-snippet__label">Snippet</span>
            <SnippetDropdown
              value={snippetTitle}
              placeholder="Select Snippet"
              suggestions={snippetSuggestions}
              onSelect={handleSnippetSelect}
            />
          </div>
          {isSnippetSelected && (
            <div className="bn-snippet__content">{snippetData}</div>
          )}
        </div>
      );
    },
  },
);

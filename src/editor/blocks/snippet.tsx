import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useSnippetAutocomplete, type SnippetSuggestion } from "../snippetAutocomplete";

type SnippetDropdownProps = {
  value: string;
  placeholder: string;
  suggestions: SnippetSuggestion[];
  selectedId: string;
  onSelect: (suggestion: SnippetSuggestion) => void;
};

function SnippetDropdown({ value, placeholder, suggestions, selectedId, onSelect }: SnippetDropdownProps) {
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
          <div className="bn-snippet-dropdown__search-wrapper">
            <div className="bn-snippet-dropdown__search">
              <svg className="bn-snippet-dropdown__search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12.917 11.667h-.659l-.233-.225a5.417 5.417 0 0 0 1.308-3.525 5.417 5.417 0 1 0-5.416 5.416 5.417 5.417 0 0 0 3.525-1.308l.225.233v.659l4.166 4.158 1.242-1.242-4.158-4.166Zm-5 0a3.745 3.745 0 0 1-3.75-3.75 3.745 3.745 0 0 1 3.75-3.75 3.745 3.745 0 0 1 3.75 3.75 3.745 3.745 0 0 1-3.75 3.75Z" fill="currentColor"/>
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
          </div>
          <div className="bn-snippet-dropdown__list">
            {filtered.map((suggestion) => {
              const isSelected = suggestion.id === selectedId;
              return (
                <button
                  type="button"
                  key={suggestion.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`bn-snippet-dropdown__item${isSelected ? " bn-snippet-dropdown__item--selected" : ""}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(suggestion);
                    setIsOpen(false);
                  }}
                  tabIndex={-1}
                >
                  <span className="bn-snippet-dropdown__item-title">{suggestion.title}</span>
                  {isSelected && (
                    <svg className="bn-snippet-dropdown__item-check" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" fill="currentColor"/>
                    </svg>
                  )}
                </button>
              );
            })}
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

      const resolvedTitle = useMemo(() => {
        if (snippetTitle) return snippetTitle;
        if (!snippetId || snippetSuggestions.length === 0) return "";
        return snippetSuggestions.find((s) => s.id === snippetId)?.title ?? "";
      }, [snippetTitle, snippetId, snippetSuggestions]);

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
        const selection = editor.getSelection();
        const blocks = selection?.blocks ?? [];
        const firstId = blocks[0]?.id;
        const lastId = blocks[blocks.length - 1]?.id;
        if (firstId === block.id && lastId === block.id) {
          return;
        }
        try {
          editor.setSelection(block.id, block.id);
        } catch {
          //
        }
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
              value={resolvedTitle}
              placeholder="Select Snippet"
              suggestions={snippetSuggestions}
              selectedId={snippetId}
              onSelect={handleSnippetSelect}
            />
          </div>
          {isSnippetSelected && snippetData && (
            <div
              className="bn-snippet__content"
              dangerouslySetInnerHTML={{
                __html: snippetData
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;"),
              }}
            />
          )}
        </div>
      );
    },
  },
);

import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { getMetaFieldSuggestions } from "../testMetaFields";

export type MetaField = { key: string; value: string };

const ID_KEYS = new Set(["id"]);

function parseMetaFields(raw: unknown): MetaField[] {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        key: typeof item.key === "string" ? item.key : "",
        value: typeof item.value === "string" ? item.value : "",
      }));
  } catch {
    return [];
  }
}

export function serializeMetaFields(fields: MetaField[]): string {
  return JSON.stringify(fields);
}

type AddFieldMenuProps = {
  kind: "test" | "suite";
  usedKeys: string[];
  onPick: (key: string) => void;
};

function AddFieldMenu({ kind, usedKeys, onPick }: AddFieldMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const available = useMemo(() => {
    const used = new Set(usedKeys.map((k) => k.trim().toLowerCase()));
    return getMetaFieldSuggestions(kind).filter((s) => !used.has(s.key.trim().toLowerCase()));
  }, [kind, usedKeys]);

  const pick = useCallback(
    (key: string) => {
      onPick(key);
      setIsOpen(false);
    },
    [onPick],
  );

  return (
    <div className="bn-testmeta__add-wrap" ref={containerRef}>
      <button
        type="button"
        className="bn-testmeta__add"
        aria-label="Add field"
        title="Add field"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        +
      </button>
      {isOpen && (
        <div className="bn-testmeta__menu" role="listbox">
          {available.map((suggestion) => (
            <button
              type="button"
              key={suggestion.key}
              role="option"
              className="bn-testmeta__menu-item"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(suggestion.key);
              }}
            >
              {suggestion.label ?? suggestion.key}
            </button>
          ))}
          <button
            type="button"
            className="bn-testmeta__menu-item bn-testmeta__menu-item--custom"
            onMouseDown={(event) => {
              event.preventDefault();
              pick("");
            }}
          >
            Custom field…
          </button>
        </div>
      )}
    </div>
  );
}

export const testMetaBlock = createReactBlockSpec(
  {
    type: "testMeta",
    content: "none",
    propSchema: {
      // "test" | "suite" — which keyword the comment opened with.
      metaKind: {
        default: "test",
      },
      // JSON-encoded MetaField[] so insertion order is preserved.
      metaFields: {
        default: "[]",
      },
      // true when the source comment was a one-liner (`<!-- test id: @T.. -->`).
      metaInline: {
        default: false,
      },
    },
  },
  {
    render: ({ block, editor }) => {
      const kind = (block.props.metaKind as string) === "suite" ? "suite" : "test";
      const fields = useMemo(
        () => parseMetaFields(block.props.metaFields),
        [block.props.metaFields],
      );

      const commitFields = useCallback(
        (next: MetaField[]) => {
          editor.updateBlock(block.id, {
            props: { metaFields: serializeMetaFields(next) } as any,
          });
        },
        [block.id, editor],
      );

      const handleValueChange = useCallback(
        (index: number, value: string) => {
          const next = fields.map((field, i) =>
            i === index ? { ...field, value } : field,
          );
          commitFields(next);
        },
        [fields, commitFields],
      );

      const handleKeyChange = useCallback(
        (index: number, key: string) => {
          const next = fields.map((field, i) =>
            i === index ? { ...field, key } : field,
          );
          commitFields(next);
        },
        [fields, commitFields],
      );

      const handleRemove = useCallback(
        (index: number) => {
          commitFields(fields.filter((_, i) => i !== index));
        },
        [fields, commitFields],
      );

      const handleAddField = useCallback(
        (key: string) => {
          commitFields([...fields, { key, value: "" }]);
        },
        [fields, commitFields],
      );

      const usedKeys = useMemo(() => fields.map((f) => f.key), [fields]);

      // The read-only `id` is shown inline on the header line next to the kind
      // label; every other field renders as an editable row below.
      const idField = fields.find((f) => ID_KEYS.has(f.key.trim().toLowerCase()));
      const editableFields = fields
        .map((field, index) => ({ field, index }))
        .filter(({ field }) => !ID_KEYS.has(field.key.trim().toLowerCase()));

      // Compact (reading) view: collapse the rows into a single truncated line
      // built only from fields that actually have a value — keys without values
      // are an editing-only concern and never appear in the compact summary (the
      // expanded rows still show them so they can be filled in). The
      // expand/collapse toggle pinned to the far right reveals the full rows.
      const summaryText = editableFields
        .filter(({ field }) => field.key.trim().length > 0 && field.value.trim().length > 0)
        .map(({ field }) => `${field.key}: ${field.value}`)
        .join("  ·  ");
      // Nothing readable to summarise (no fields, or only empty values) -> start
      // expanded so the block is immediately editable. `expanded` is UI-only
      // state — never serialized.
      const [expanded, setExpanded] = useState(() => summaryText.length === 0);

      return (
        <div
          className={`bn-testmeta${expanded ? " bn-testmeta--expanded" : " bn-testmeta--collapsed"}`}
          data-block-id={block.id}
          data-kind={kind}
          contentEditable={false}
          suppressContentEditableWarning
          draggable={false}
        >
          <div className="bn-testmeta__header">
            <span className="bn-testmeta__label">{kind.toUpperCase()}</span>
            {idField?.value && <span className="bn-testmeta__id">{idField.value}</span>}
            {!expanded && (
              <button
                type="button"
                className="bn-testmeta__summary"
                title={summaryText || "No metadata yet"}
                onClick={() => setExpanded(true)}
              >
                {summaryText || <span className="bn-testmeta__summary--empty">No metadata</span>}
              </button>
            )}
            <div className="bn-testmeta__actions">
              {expanded && <AddFieldMenu kind={kind} usedKeys={usedKeys} onPick={handleAddField} />}
              <button
                type="button"
                className={`bn-testmeta__toggle${expanded ? " bn-testmeta__toggle--expanded" : ""}`}
                aria-expanded={expanded}
                aria-label={expanded ? "Collapse metadata" : "Expand metadata"}
                title={expanded ? "Collapse" : "Expand"}
                onClick={() => setExpanded((prev) => !prev)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          {expanded && editableFields.length > 0 && (
            <div className="bn-testmeta__rows">
              {editableFields.map(({ field, index }) => (
                <div className="bn-testmeta__row" key={index}>
                  <input
                    className="bn-testmeta__key bn-testmeta__key--input"
                    type="text"
                    value={field.key}
                    placeholder="key"
                    spellCheck={false}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleKeyChange(index, e.target.value)}
                  />
                  <input
                    className="bn-testmeta__value"
                    type="text"
                    value={field.value}
                    placeholder="value"
                    spellCheck={false}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleValueChange(index, e.target.value)}
                  />
                  <button
                    type="button"
                    className="bn-testmeta__remove"
                    aria-label="Remove field"
                    title="Remove field"
                    onClick={() => handleRemove(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },
  },
);

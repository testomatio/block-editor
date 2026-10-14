import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useRef, useState } from "react";
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

type TestEditorLike = {
  document: any[];
  getTextCursorPosition?: () => { block?: { id?: string } };
  insertBlocks: (
    blocks: any[],
    referenceId: string,
    placement: "before" | "after",
  ) => any[];
};

/** Reads the `labels` value from the first suite `testMeta` block, if any. */
function suiteLabelsFromDocument(document: any[]): string {
  for (const block of document) {
    if (block?.type !== "testMeta") continue;
    if ((block.props as any)?.metaKind !== "suite") continue;
    const fields = parseMetaFields((block.props as any)?.metaFields);
    const labels = fields.find((f) => f.key.trim().toLowerCase() === "labels");
    if (labels) return labels.value;
  }
  return "";
}

/**
 * Insert a new test: a `testMeta` panel
 * seeded with default metadata — `type: manual`, `priority: normal`, and `labels`
 * copied from the suite block — followed by an empty H2 heading for the test title.
 *
 * Inserts at the text cursor when the editor is focused, otherwise at the end of
 * the document. Returns the title heading's block id (for focusing), or null.
 */
export function addTestBlock(editor: TestEditorLike): string | null {
  const fields: MetaField[] = [
    { key: "type", value: "manual" },
    { key: "priority", value: "normal" },
    { key: "labels", value: suiteLabelsFromDocument(editor.document) },
  ];

  const metaBlock = {
    type: "testMeta" as const,
    props: {
      metaKind: "test",
      metaFields: serializeMetaFields(fields),
      metaInline: false,
    },
    children: [],
  };
  const titleHeading = {
    type: "heading" as const,
    props: { level: 2 },
    content: [],
    children: [],
  };

  // Prefer the text cursor position — BlockNote keeps it in the editor state even
  // after the editor blurs (e.g. when a toolbar button is clicked), so the test
  // lands where the user left the caret. Fall back to the document end only when
  // there is no cursor at all.
  const docs = editor.document;
  let referenceId: string | undefined;
  try {
    referenceId = editor.getTextCursorPosition?.().block?.id;
  } catch {
    referenceId = undefined;
  }
  if (!referenceId) referenceId = docs[docs.length - 1]?.id;
  if (!referenceId) return null;

  const inserted = editor.insertBlocks([metaBlock, titleHeading], referenceId, "after");
  return inserted?.[1]?.id ?? null;
}

/**
 * The `<!-- test -->` / `<!-- suite -->` header: a card that folds open into
 * its fields. Shut, it shows the id, the first filled field and how many more.
 */
export function TestMetaCard({ kind, fields, onChange, readOnly }: TestMetaCardProps) {
  const id = fields.find(isIdField)?.value;
  const rows = fields
    .map((field, index) => ({ field, index }))
    .filter(({ field }) => !isIdField(field));
  const filled = rows
    .filter(({ field }) => field.key.trim() && field.value.trim())
    .map(({ field }) => `${field.key}: ${field.value}`);
  const summary = filled[0];
  const more = filled.length - 1;
  const [open, setOpen] = useState(() => !summary && rows.length > 0);

  const update = (index: number, patch: Partial<MetaField>) =>
    onChange(fields.map((field, i) => (i === index ? { ...field, ...patch } : field)));
  const add = (key: string) => {
    onChange([...fields, { key, value: "" }]);
    setOpen(true);
  };

  return (
    <div
      className={`bn-testmeta${open ? " bn-testmeta--open" : ""}`}
      data-kind={kind}
      data-source={fields.map((field) => `${field.key}: ${field.value}`).join("\n")}
    >
      <div className={`bn-testmeta__header${readOnly ? "" : " bn-testmeta__header--actions"}`}>
        <button
          type="button"
          className="bn-testmeta__trigger"
          aria-expanded={open}
          aria-label={open ? "Hide details" : "Show details"}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="bn-testmeta__title">
            <span className="bn-testmeta__label">{KIND_LABEL[kind]}</span>
            {id && <span className="bn-testmeta__id">{id}</span>}
            {!open && summary && <span className="bn-testmeta__summary">{summary}</span>}
            {!open && more > 0 && <span className="bn-testmeta__more">+{more}</span>}
          </span>
          {!open && !summary && <span className="bn-testmeta__status">No details</span>}
          <svg className="bn-testmeta__chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {!readOnly && (
          <AddFieldMenu kind={kind} usedKeys={fields.map((field) => field.key)} onPick={add} />
        )}
      </div>
      {open && (
        <div className="bn-testmeta__rows">
          {rows.length === 0 && <p className="bn-testmeta__empty">No details yet.</p>}
          {rows.map(({ field, index }) => (
            <div className="bn-testmeta__row" key={index}>
              <input
                className="bn-testmeta__key"
                type="text"
                value={field.key}
                placeholder="Field"
                spellCheck={false}
                readOnly={readOnly}
                aria-label="Field name"
                onChange={(event) => update(index, { key: event.target.value })}
              />
              <input
                className="bn-testmeta__value"
                type="text"
                value={field.value}
                placeholder="Empty"
                spellCheck={false}
                readOnly={readOnly}
                aria-label={`${field.key || "Field"} value`}
                onChange={(event) => update(index, { value: event.target.value })}
              />
              {!readOnly && (
                <button
                  type="button"
                  className="bn-testmeta__icon-btn bn-testmeta__remove"
                  aria-label="Remove field"
                  data-tooltip="Remove field"
                  onClick={() => onChange(fields.filter((_, i) => i !== index))}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddFieldMenu({ kind, usedKeys, onPick }: AddFieldMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const taken = new Set(usedKeys.map((key) => key.trim().toLowerCase()));
  const options = getMetaFieldSuggestions(kind).filter(
    (option) => !taken.has(option.key.trim().toLowerCase()),
  );
  const pick = (key: string) => {
    onPick(key);
    setIsOpen(false);
  };

  return (
    <div className="bn-testmeta__actions" ref={containerRef}>
      <button
        type="button"
        className="bn-testmeta__icon-btn bn-testmeta__add"
        aria-label="Add field"
        aria-expanded={isOpen}
        data-tooltip={isOpen ? undefined : "Add field"}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3.5V12.5M3.5 8H12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {isOpen && (
        <div className="bn-testmeta__menu" role="menu">
          {options.map((option) => (
            <button
              type="button"
              key={option.key}
              role="menuitem"
              className="bn-testmeta__menu-item"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(option.key);
              }}
            >
              {option.label ?? option.key}
            </button>
          ))}
          {options.length > 0 && <div className="bn-testmeta__menu-separator" role="separator" />}
          <button
            type="button"
            role="menuitem"
            className="bn-testmeta__menu-item"
            onMouseDown={(event) => {
              event.preventDefault();
              pick("");
            }}
          >
            Custom field
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
    render: ({ block, editor }) => (
      <div
        className="bn-testmeta-block"
        data-block-id={block.id}
        contentEditable={false}
        suppressContentEditableWarning
        draggable={false}
      >
        <TestMetaCard
          kind={block.props.metaKind === "suite" ? "suite" : "test"}
          fields={parseMetaFields(block.props.metaFields)}
          readOnly={!editor.isEditable}
          onChange={(next) =>
            editor.updateBlock(block.id, {
              props: { metaFields: serializeMetaFields(next) } as any,
            })
          }
        />
      </div>
    ),
  },
);

function isIdField(field: MetaField) {
  return ID_KEYS.has(field.key.trim().toLowerCase());
}

const KIND_LABEL: Record<MetaKind, string> = { test: "Test", suite: "Suite" };

type MetaKind = "test" | "suite";

export type TestMetaCardProps = {
  kind: MetaKind;
  fields: MetaField[];
  onChange: (fields: MetaField[]) => void;
  readOnly?: boolean;
};

type AddFieldMenuProps = {
  kind: MetaKind;
  usedKeys: string[];
  onPick: (key: string) => void;
};

export type MetaFieldSuggestion = {
  /** The field key that gets inserted, e.g. "priority". */
  key: string;
  /** Optional display label; defaults to `key`. */
  label?: string;
};

/**
 * Either a flat list (applied to both test and suite blocks) or per-kind lists.
 * Configure from the host app via `setMetaFieldSuggestions` so embedders can
 * plug in their own set of suggested metadata fields.
 */
export type MetaFieldSuggestionsConfig =
  | MetaFieldSuggestion[]
  | { test?: MetaFieldSuggestion[]; suite?: MetaFieldSuggestion[] };

// Defaults follow the classical Testomatio markdown format. `id` is intentionally
// omitted: it is a read-only, system-assigned field, not something users add.
// `creator`/`shared` are likewise not offered — they are managed elsewhere. The
// list only drives the "+" menu, so fields already present in the markdown (any
// key, including these) keep rendering and round-tripping untouched.
const DEFAULT_TEST_FIELDS: MetaFieldSuggestion[] = [
  { key: "priority" },
  { key: "type" },
  { key: "tags" },
  { key: "labels" },
  { key: "assignee" },
  { key: "issues" },
];

const DEFAULT_SUITE_FIELDS: MetaFieldSuggestion[] = [
  { key: "emoji" },
  { key: "tags" },
  { key: "labels" },
  { key: "assignee" },
];

let configured: MetaFieldSuggestionsConfig | null = null;

export function setMetaFieldSuggestions(config: MetaFieldSuggestionsConfig | null) {
  configured = config;
}

export function getMetaFieldSuggestions(kind: "test" | "suite"): MetaFieldSuggestion[] {
  if (configured) {
    if (Array.isArray(configured)) {
      return configured;
    }
    const list = kind === "suite" ? configured.suite : configured.test;
    if (list) {
      return list;
    }
  }
  return kind === "suite" ? DEFAULT_SUITE_FIELDS : DEFAULT_TEST_FIELDS;
}

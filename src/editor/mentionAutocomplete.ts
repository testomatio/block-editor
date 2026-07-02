/**
 * Universal, prefix-based `@`-mention autocomplete.
 *
 * A single mechanism that turns typed tokens like `@`, `@T`, `@S` into inserted
 * references such as `@T123456`, `@S98765`, or `@username`. Which list is shown
 * (and what gets inserted) is decided by a configurable set of {@link MentionSource}s,
 * each keyed by the characters that follow the `@`:
 *
 *   { prefix: "T", search: (q) => api.findTests(q) }        // @T -> fetch tests -> "@T123456"
 *   { prefix: "S", search: (q) => api.findSuites(q) }       // @S -> fetch suites -> "@S98765"
 *   { prefix: "",  items: users, insert: (u) => `@${u.label}` } // @  -> filter users -> "@john"
 *
 * This file is intentionally DOM-free: it holds only the pure logic (matching,
 * source resolution, filtering, token building) plus the global source registry.
 * The React wiring lives in `MentionAutocomplete.tsx`.
 */

export type MentionItem = {
  /** Stable identifier. For test/suite sources this is what gets inserted (`@T{id}`). */
  id: string;
  /** Primary text shown in the popup and used for client-side filtering. */
  label: string;
  /** Optional secondary text (e.g. `#123`, an email, a description). */
  detail?: string | null;
  /**
   * Optional explicit text to insert for this specific item. When omitted the
   * source's `insert` builder (or the default `@{prefix}{id}`) is used.
   */
  insertText?: string;
  /** Sources may carry arbitrary extra data through to their renderers. */
  [key: string]: unknown;
};

/** Static item list, or a (possibly async) provider of one. */
export type MentionItemsInput =
  | MentionItem[]
  | (() => MentionItem[] | Promise<MentionItem[]>);

/** Result of an async `search`. May be raw items or a JSON:API document. */
export type MentionSearchResult =
  | MentionItem[]
  | MentionJsonApiDocument
  | MentionJsonApiResource[]
  | null
  | undefined;

export type MentionSource = {
  /**
   * Characters that must appear immediately after `@` to select this source.
   * Use `""` for the default/fallback source (e.g. usernames on a bare `@`).
   * Matching is case-sensitive and longest-prefix wins, so `@T` routes to the
   * `"T"` source rather than the `""` source.
   */
  prefix: string;
  /** Human label for the popup header / grouping (e.g. "Tests", "Users"). */
  label?: string;
  /**
   * Static list (or provider). Filtered client-side by the typed query. Use
   * this for data already in memory, like the list of project members.
   */
  items?: MentionItemsInput;
  /**
   * Async fetcher invoked with the typed query (the text after the prefix).
   * Use this for server-backed lookups like tests (`@T`) and suites (`@S`).
   */
  search?: (query: string) => Promise<MentionSearchResult> | MentionSearchResult;
  /**
   * Builds the text inserted when an item is chosen. Defaults to
   * `@{prefix}{id}` (so a test with id `123456` becomes `@T123456`).
   */
  insert?: (item: MentionItem, source: MentionSource) => string;
  /** Minimum query length before `search` runs. Default 0 (fires on empty query). */
  minChars?: number;
  /** Max items shown. Default 8. */
  limit?: number;
};

/** A currently-active mention detected at the caret. */
export type ActiveMention = {
  source: MentionSource;
  /** Matched prefix (e.g. "T", "S", or ""). */
  prefix: string;
  /** Text typed after the prefix (what `search`/filter receives). */
  query: string;
  /** Index of the `@` in the source text. */
  start: number;
  /** Caret index (exclusive end of the token being edited). */
  end: number;
  /** Full token text between `@` (exclusive) and the caret, i.e. `prefix + query`. */
  token: string;
};

/* ------------------------------------------------------------------ *
 * JSON:API shapes (mirrors stepAutocomplete / snippetAutocomplete)
 * ------------------------------------------------------------------ */

export type MentionJsonApiAttributes = {
  title?: string | null;
  name?: string | null;
  label?: string | null;
  username?: string | null;
  email?: string | null;
  description?: string | null;
  detail?: string | null;
  [key: string]: unknown;
};

export type MentionJsonApiResource = {
  id?: string | number | null;
  type?: string | null;
  attributes?: MentionJsonApiAttributes | null;
};

export type MentionJsonApiDocument = {
  data?: MentionJsonApiResource[] | null;
};

/* ------------------------------------------------------------------ *
 * Global source registry (dependency-injection seam, mirrors the rest
 * of the library's `setXFetcher` pattern).
 * ------------------------------------------------------------------ */

let globalSources: MentionSource[] = [];

/** Register the mention sources used when a consumer doesn't pass `sources` explicitly. */
export function setMentionSources(sources: MentionSource[] | null): void {
  globalSources = Array.isArray(sources) ? sources : [];
}

/** Read the globally-registered mention sources. */
export function getMentionSources(): MentionSource[] {
  return globalSources;
}

/* ------------------------------------------------------------------ *
 * Pure logic
 * ------------------------------------------------------------------ */

const WHITESPACE = /\s/;

/**
 * Pick the source whose `prefix` matches the start of `token`. Longest prefix
 * wins; the empty-prefix source is the ultimate fallback. Returns `null` when
 * nothing matches (e.g. `@T` typed but only a `""` source is registered and it
 * is absent).
 */
export function resolveMentionSource(
  token: string,
  sources: MentionSource[],
): MentionSource | null {
  let best: MentionSource | null = null;
  for (const source of sources) {
    const prefix = source.prefix ?? "";
    if (!token.startsWith(prefix)) continue;
    if (best === null || prefix.length > (best.prefix ?? "").length) {
      best = source;
    }
  }
  return best;
}

/**
 * Detect the mention being edited at `caret` within `text`.
 *
 * A mention is the run of non-whitespace characters after an `@` that sits at
 * the start of the text or immediately after whitespace (so emails like
 * `a@b.com` never trigger). Returns `null` when the caret is not inside such a
 * token or no source matches.
 */
export function parseActiveMention(
  text: string,
  caret: number,
  sources: MentionSource[],
): ActiveMention | null {
  if (!sources.length) return null;
  const pos = Math.max(0, Math.min(caret, text.length));
  const before = text.slice(0, pos);

  const at = before.lastIndexOf("@");
  if (at === -1) return null;

  // The `@` must start a word: preceded by nothing or whitespace.
  const charBefore = at === 0 ? "" : text[at - 1];
  if (charBefore !== "" && !WHITESPACE.test(charBefore)) return null;

  // The token is everything from just after `@` up to the caret. Whitespace
  // ends a mention, so a caret past a space means we're no longer inside one.
  const token = before.slice(at + 1);
  if (WHITESPACE.test(token)) return null;

  const source = resolveMentionSource(token, sources);
  if (!source) return null;

  const prefix = source.prefix ?? "";
  return {
    source,
    prefix,
    query: token.slice(prefix.length),
    start: at,
    end: pos,
    token,
  };
}

/** The text a chosen item inserts, honoring item/source overrides. */
export function buildMentionInsertText(source: MentionSource, item: MentionItem): string {
  if (typeof item.insertText === "string") return item.insertText;
  if (typeof source.insert === "function") return source.insert(item, source);
  return `@${source.prefix ?? ""}${item.id}`;
}

export type MentionApplication = {
  /** The full text after replacing the active token with the inserted mention. */
  text: string;
  /** Caret position after insertion (after the token and its trailing space). */
  caret: number;
};

/**
 * Replace the active mention token in `text` with `insertText`, adding a single
 * trailing space so the caret lands ready for the next word and the freshly
 * inserted `@…` token does not immediately re-trigger the popup.
 */
export function applyMention(
  text: string,
  active: Pick<ActiveMention, "start" | "end">,
  insertText: string,
): MentionApplication {
  const before = text.slice(0, active.start);
  const after = text.slice(active.end);
  const hasLeadingSpace = after.length > 0 && WHITESPACE.test(after[0]);
  const separator = hasLeadingSpace ? "" : " ";
  return {
    text: `${before}${insertText}${separator}${after}`,
    // Land just past the single following space (added or pre-existing) so the
    // caret is ready for the next word.
    caret: before.length + insertText.length + 1,
  };
}

/**
 * Rank static items against a query: label starts-with beats label contains,
 * which beats id matches. Case-insensitive. An empty query returns the head of
 * the list unchanged.
 */
export function filterMentionItems(
  items: MentionItem[],
  query: string,
  limit = 8,
): MentionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);

  const scored: Array<{ item: MentionItem; score: number; order: number }> = [];
  items.forEach((item, order) => {
    const label = (item.label ?? "").toLowerCase();
    const id = String(item.id ?? "").toLowerCase();
    const detail = (item.detail ?? "").toString().toLowerCase();
    let score = -1;
    if (label.startsWith(q)) score = 0;
    else if (label.includes(q)) score = 1;
    else if (id.startsWith(q) || id.includes(q)) score = 2;
    else if (detail.includes(q)) score = 3;
    if (score >= 0) scored.push({ item, score, order });
  });

  scored.sort((a, b) => (a.score - b.score) || (a.order - b.order));
  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Route a typed query (everything after the trigger char, e.g. `T123` or `bob`)
 * to its source and resolve the items to show. Handles prefix stripping,
 * `minChars`, async `search`, static `items` (incl. provider functions),
 * normalization, and the `limit`. Returns `null` when no source matches.
 *
 * Shared by both mention frontends (the textarea hook and the BlockNote menu).
 */
export async function resolveMentionQuery(
  query: string,
  sources: MentionSource[],
): Promise<{ source: MentionSource; items: MentionItem[] } | null> {
  const source = resolveMentionSource(query, sources);
  if (!source) return null;

  const prefix = source.prefix ?? "";
  const sub = query.slice(prefix.length);
  const limit = source.limit ?? 8;

  if (typeof source.search === "function") {
    const minChars = source.minChars ?? 0;
    if (sub.length < minChars) return { source, items: [] };
    const items = normalizeMentionItems(await source.search(sub)).slice(0, limit);
    return { source, items };
  }

  const input = source.items;
  const raw = typeof input === "function" ? await input() : input ?? [];
  const items = filterMentionItems(normalizeMentionItems(raw), sub, limit);
  return { source, items };
}

/* ------------------------------------------------------------------ *
 * Normalization of async / JSON:API results into MentionItem[]
 * ------------------------------------------------------------------ */

export function parseMentionsFromJsonApi(
  document: MentionJsonApiDocument | MentionJsonApiResource[] | null | undefined,
): MentionItem[] {
  const resources = Array.isArray(document) ? document : document?.data;
  if (!Array.isArray(resources) || resources.length === 0) return [];
  return resources
    .map((resource) => normalizeJsonApiResource(resource))
    .filter((value): value is MentionItem => Boolean(value));
}

/** Coerce any supported `search`/`items` result into a clean `MentionItem[]`. */
export function normalizeMentionItems(result: MentionSearchResult): MentionItem[] {
  if (!result) return [];
  if (Array.isArray(result)) {
    if (result.length === 0) return [];
    if (isMentionItemArray(result)) return result as MentionItem[];
    return parseMentionsFromJsonApi(result as MentionJsonApiResource[]);
  }
  return parseMentionsFromJsonApi(result);
}

function normalizeJsonApiResource(
  resource: MentionJsonApiResource | null | undefined,
): MentionItem | null {
  if (!resource) return null;
  const attrs = resource.attributes ?? {};
  const id = resource.id;
  if (id === null || id === undefined || id === "") return null;

  const label =
    attrs.title ?? attrs.name ?? attrs.label ?? attrs.username ?? String(id);
  return {
    id: String(id),
    label: String(label),
    detail: attrs.detail ?? attrs.description ?? attrs.email ?? null,
  };
}

function isMentionItemArray(value: unknown[]): boolean {
  const first = value[0] as Partial<MentionItem> | undefined;
  return Boolean(first) && typeof first?.label === "string";
}

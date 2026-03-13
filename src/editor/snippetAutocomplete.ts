import { useEffect, useState } from "react";

export type SnippetSuggestion = {
  id: string;
  title: string;
  body?: string | null;
  description?: string | null;
  usageCount?: number | null;
  isSnippet?: boolean | null;
};

export type SnippetJsonApiAttributes = {
  title?: string | null;
  body?: string | null;
  description?: string | null;
  "usage-count"?: number | string | null;
  "is-snippet"?: boolean | null;
};

export type SnippetJsonApiResource = {
  id?: string | number | null;
  type?: string | null;
  attributes?: SnippetJsonApiAttributes | null;
};

export type SnippetJsonApiDocument = {
  data?: SnippetJsonApiResource[] | null;
};

export type SnippetSuggestionsFetcher = () => Promise<SnippetInput> | SnippetInput;

type SnippetInput = SnippetSuggestion[] | SnippetJsonApiDocument | SnippetJsonApiResource[] | null | undefined;

let globalFetcher: SnippetSuggestionsFetcher | null = null;
let cachedSuggestions: SnippetSuggestion[] = [];
let inflightPromise: Promise<SnippetSuggestion[]> | null = null;

export function setSnippetFetcher(fetcher: SnippetSuggestionsFetcher | null) {
  globalFetcher = fetcher;
  cachedSuggestions = [];
  inflightPromise = null;
}

export function useSnippetAutocomplete(): SnippetSuggestion[] {
  const [suggestions, setSuggestions] = useState<SnippetSuggestion[]>(() => {
    if (cachedSuggestions.length > 0) return cachedSuggestions;
    if (!globalFetcher) return [];
    const result = globalFetcher();
    if (result && typeof (result as Promise<unknown>).then === "function") {
      if (!inflightPromise) {
        inflightPromise = (result as Promise<SnippetInput>)
          .then((r) => normalizeSnippetSuggestions(r))
          .then((items) => { cachedSuggestions = items; inflightPromise = null; return items; })
          .catch((error) => { inflightPromise = null; console.error("Failed to fetch snippet suggestions", error); return [] as SnippetSuggestion[]; });
      }
      return [];
    }
    const normalized = normalizeSnippetSuggestions(result as SnippetInput);
    cachedSuggestions = normalized;
    return normalized;
  });

  useEffect(() => {
    if (suggestions.length > 0) {
      return;
    }
    if (!globalFetcher) {
      return;
    }

    let cancelled = false;
    if (!inflightPromise) {
      inflightPromise = Promise.resolve(globalFetcher())
        .then((result) => normalizeSnippetSuggestions(result))
        .then((items) => {
          cachedSuggestions = items;
          inflightPromise = null;
          return items;
        })
        .catch((error) => {
          inflightPromise = null;
          console.error("Failed to fetch snippet suggestions", error);
          return [] as SnippetSuggestion[];
        });
    }
    inflightPromise.then((items) => {
      if (!cancelled) setSuggestions(items);
    });

    return () => {
      cancelled = true;
    };
  }, [suggestions.length]);

  return suggestions;
}

export function parseSnippetsFromJsonApi(
  document: SnippetJsonApiDocument | SnippetJsonApiResource[] | null | undefined,
): SnippetSuggestion[] {
  const resources = Array.isArray(document) ? document : document?.data;
  if (!Array.isArray(resources) || resources.length === 0) {
    return [];
  }

  return resources
    .map((resource) => normalizeJsonApiResource(resource))
    .filter((value): value is SnippetSuggestion => Boolean(value));
}

function normalizeSnippetSuggestions(snippets?: SnippetInput): SnippetSuggestion[] {
  if (!snippets) return [];

  if (Array.isArray(snippets)) {
    if (snippets.length === 0) return [];
    if (isSnippetSuggestionArray(snippets)) return snippets;
    return parseSnippetsFromJsonApi(snippets);
  }

  return parseSnippetsFromJsonApi(snippets);
}

function normalizeJsonApiResource(resource: SnippetJsonApiResource | null | undefined): SnippetSuggestion | null {
  if (!resource) return null;
  const attrs = resource.attributes;
  const id = resource.id;
  const title = attrs?.title ?? "";
  if (!id || !title) return null;

  return {
    id: String(id),
    title: String(title),
    body: attrs?.body ?? attrs?.description ?? null,
    description: attrs?.description ?? null,
    usageCount: coerceNumber(attrs?.["usage-count"]),
    isSnippet: attrs?.["is-snippet"] === true,
  };
}

function isSnippetSuggestionArray(value: SnippetInput): value is SnippetSuggestion[] {
  return Array.isArray(value) && value.length > 0 && typeof (value[0] as SnippetSuggestion | any)?.title === "string";
}

function coerceNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

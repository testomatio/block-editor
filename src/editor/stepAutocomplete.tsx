import { useEffect, useState } from "react";

export type StepSuggestion = {
  id: string;
  title: string;
  description?: string | null;
  kind?: string | null;
  usageCount?: number | null;
  commentsCount?: number | null;
  isSnippet?: boolean | null;
  labels?: string[];
  keywords?: string[];
};

export type StepJsonApiAttributes = {
  title?: string | null;
  description?: string | null;
  kind?: string | null;
  keywords?: string[] | null;
  labels?: string[] | null;
  "usage-count"?: number | string | null;
  "comments-count"?: number | string | null;
  "is-snippet"?: boolean | null;
};

export type StepJsonApiResource = {
  id?: string | number | null;
  type?: string | null;
  attributes?: StepJsonApiAttributes | null;
};

export type StepJsonApiDocument = {
  data?: StepJsonApiResource[] | null;
};

export type StepSuggestionsFetcher = () => Promise<StepInput> | StepInput;

type StepInput = StepSuggestion[] | StepJsonApiDocument | StepJsonApiResource[] | null | undefined;

let globalFetcher: StepSuggestionsFetcher | null = null;
let cachedSuggestions: StepSuggestion[] = [];

export function setGlobalStepSuggestionsFetcher(fetcher: StepSuggestionsFetcher | null) {
  globalFetcher = fetcher;
  cachedSuggestions = [];
}

export function useStepAutocomplete(): StepSuggestion[] {
  const [suggestions, setSuggestions] = useState<StepSuggestion[]>(() => {
    if (cachedSuggestions.length > 0) {
      return cachedSuggestions;
    }
    if (globalFetcher) {
      const result = globalFetcher();
      if (!result || typeof (result as Promise<unknown>).then !== "function") {
        const normalized = normalizeStepSuggestions(result as StepInput);
        cachedSuggestions = normalized;
        return normalized;
      }
    }
    return [];
  });

  useEffect(() => {
    if (suggestions.length > 0) {
      return;
    }
    if (!globalFetcher) {
      return;
    }

    let cancelled = false;
    Promise.resolve(globalFetcher())
      .then((result) => normalizeStepSuggestions(result))
      .then((items) => {
        if (cancelled) return;
        cachedSuggestions = items;
        setSuggestions(items);
      })
      .catch((error) => console.error("Failed to fetch step suggestions", error));

    return () => {
      cancelled = true;
    };
  }, [suggestions.length]);

  return suggestions;
}

export function parseStepsFromJsonApi(
  document: StepJsonApiDocument | StepJsonApiResource[] | null | undefined,
): StepSuggestion[] {
  const resources = Array.isArray(document) ? document : document?.data;
  if (!Array.isArray(resources) || resources.length === 0) {
    return [];
  }

  return resources
    .map((resource) => normalizeJsonApiResource(resource))
    .filter((value): value is StepSuggestion => Boolean(value));
}

function normalizeStepSuggestions(steps?: StepInput): StepSuggestion[] {
  if (!steps) return [];

  if (Array.isArray(steps)) {
    if (steps.length === 0) return [];
    if (isStepSuggestionArray(steps)) return steps;
    return parseStepsFromJsonApi(steps);
  }

  return parseStepsFromJsonApi(steps);
}

function normalizeJsonApiResource(resource: StepJsonApiResource | null | undefined): StepSuggestion | null {
  if (!resource) return null;
  const attrs = resource.attributes;
  const id = resource.id;
  const title = attrs?.title ?? "";
  if (!id || !title) return null;

  return {
    id: String(id),
    title: String(title),
    description: attrs?.description ?? null,
    kind: attrs?.kind ?? null,
    usageCount: coerceNumber(attrs?.["usage-count"]),
    commentsCount: coerceNumber(attrs?.["comments-count"]),
    isSnippet: attrs?.["is-snippet"] ?? null,
    labels: attrs?.labels ?? [],
    keywords: attrs?.keywords ?? [],
  };
}

function isStepSuggestionArray(value: StepInput): value is StepSuggestion[] {
  return Array.isArray(value) && value.length > 0 && typeof (value[0] as StepSuggestion | any)?.title === "string";
}

function coerceNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

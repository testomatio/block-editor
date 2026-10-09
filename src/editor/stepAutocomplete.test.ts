import { describe, expect, it } from "vitest";
import { parseStepsFromJsonApi } from "./stepAutocomplete";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import {
  STEP_AUTOCOMPLETE_ATTRIBUTE,
  isStepAutocompleteOnTypeEnabled,
  setStepsFetcher,
  useStepAutocomplete,
} from "./stepAutocomplete";

describe("parseStepsFromJsonApi", () => {
  it("converts JSON:API resources into step suggestions", () => {
    const suggestions = parseStepsFromJsonApi({
      data: [
        {
          id: "42",
          type: "step",
          attributes: {
            title: "Click the red button",
            description: "Opens the modal",
            kind: "manual",
            labels: ["ui"],
            keywords: ["button"],
            "usage-count": 12,
            "comments-count": 4,
            "is-snippet": true,
          },
        },
      ],
    });

    expect(suggestions).toEqual([
      {
        id: "42",
        title: "Click the red button",
        description: "Opens the modal",
        kind: "manual",
        labels: ["ui"],
        keywords: ["button"],
        usageCount: 12,
        commentsCount: 4,
        isSnippet: true,
      },
    ]);
  });

  it("skips entries without identifiers or titles", () => {
    const suggestions = parseStepsFromJsonApi({
      data: [
        { id: "100", type: "step", attributes: { title: "" } },
        { type: "step", attributes: { title: "Valid Step" } },
        { id: "101", type: "step", attributes: { title: "Another Step" } },
      ],
    });

    expect(suggestions).toEqual([
      {
        id: "101",
        title: "Another Step",
        description: null,
        kind: null,
        labels: [],
        keywords: [],
        usageCount: null,
        commentsCount: null,
        isSnippet: null,
      },
    ]);
  });

  it("accepts a raw array of JSON:API resources", () => {
    const suggestions = parseStepsFromJsonApi([
      {
        id: "200",
        type: "step",
        attributes: { title: "Enter credentials" },
      },
      {
        id: "201",
        type: "step",
        attributes: { title: "Click submit" },
      },
    ]);

    expect(suggestions.map((item) => item.title)).toEqual([
      "Enter credentials",
      "Click submit",
    ]);
  });

  it("reads suggestions from the global fetcher via useStepAutocomplete", () => {
    setStepsFetcher(() => [{ id: "1", title: "Global step" }]);

    let seen: any[] = [];
    const Probe = () => {
      seen = useStepAutocomplete();
      return null;
    };

    renderToStaticMarkup(React.createElement(Probe));

    expect(seen).toEqual([{ id: "1", title: "Global step" }]);

    // reset for other tests
    setStepsFetcher(null);
  });
});

describe("isStepAutocompleteOnTypeEnabled", () => {
  const nodeWithHost = (value: string | null) =>
    ({
      closest: (selector: string) => {
        expect(selector).toBe(`[${STEP_AUTOCOMPLETE_ATTRIBUTE}]`);
        return value === null ? null : { getAttribute: () => value };
      },
    }) as unknown as Element;

  it("is enabled without a node", () => {
    expect(isStepAutocompleteOnTypeEnabled(null)).toBe(true);
  });

  it("is enabled when no ancestor carries the attribute", () => {
    expect(isStepAutocompleteOnTypeEnabled(nodeWithHost(null))).toBe(true);
  });

  it("is enabled when the attribute is \"true\"", () => {
    expect(isStepAutocompleteOnTypeEnabled(nodeWithHost("true"))).toBe(true);
  });

  it("is disabled when the attribute is \"false\"", () => {
    expect(isStepAutocompleteOnTypeEnabled(nodeWithHost("false"))).toBe(false);
  });
});

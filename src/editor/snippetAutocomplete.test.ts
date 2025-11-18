import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import {
  setSnippetFetcher,
  useSnippetAutocomplete,
  parseSnippetsFromJsonApi,
} from "./snippetAutocomplete";

describe("snippet autocomplete", () => {
  it("parses JSON:API snippet resources", () => {
    const suggestions = parseSnippetsFromJsonApi({
      data: [
        {
          id: "501",
          type: "snippet",
          attributes: {
            title: "Login setup",
            body: "Open /login",
            description: "Ready state",
            "usage-count": 4,
          },
        },
      ],
    });

    expect(suggestions).toEqual([
      {
        id: "501",
        title: "Login setup",
        body: "Open /login",
        description: "Ready state",
        usageCount: 4,
        isSnippet: true,
      },
    ]);
  });

  it("reads suggestions from the global snippet fetcher via useSnippetAutocomplete", () => {
    setSnippetFetcher(() => [{ id: "1", title: "Reusable snippet" }]);

    let seen: any[] = [];
    const Probe = () => {
      seen = useSnippetAutocomplete();
      return null;
    };

    renderToStaticMarkup(React.createElement(Probe));

    expect(seen).toEqual([{ id: "1", title: "Reusable snippet" }]);

    setSnippetFetcher(null);
  });
});

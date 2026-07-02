import { describe, expect, it } from "vitest";
import {
  applyMention,
  buildMentionInsertText,
  filterMentionItems,
  getMentionSources,
  normalizeMentionItems,
  parseActiveMention,
  parseMentionsFromJsonApi,
  resolveMentionQuery,
  resolveMentionSource,
  setMentionSources,
  type MentionItem,
  type MentionSource,
} from "./mentionAutocomplete";

const users: MentionItem[] = [
  { id: "u1", label: "alice", detail: "alice@team.io" },
  { id: "u2", label: "bob", detail: "bob@team.io" },
  { id: "u3", label: "albert", detail: "albert@team.io" },
];

const sources: MentionSource[] = [
  { prefix: "T", label: "Tests", search: () => [] },
  { prefix: "S", label: "Suites", search: () => [] },
  { prefix: "", label: "Users", items: users, insert: (item) => `@${item.label}` },
];

describe("resolveMentionSource", () => {
  it("routes single-letter prefixes to their source", () => {
    expect(resolveMentionSource("T123", sources)?.prefix).toBe("T");
    expect(resolveMentionSource("S9", sources)?.prefix).toBe("S");
  });

  it("falls back to the empty-prefix source", () => {
    expect(resolveMentionSource("bob", sources)?.prefix).toBe("");
    expect(resolveMentionSource("", sources)?.prefix).toBe("");
  });

  it("prefers the longest matching prefix", () => {
    const withLong: MentionSource[] = [
      { prefix: "T" },
      { prefix: "TC" },
      { prefix: "" },
    ];
    expect(resolveMentionSource("TC5", withLong)?.prefix).toBe("TC");
    expect(resolveMentionSource("T5", withLong)?.prefix).toBe("T");
  });

  it("returns null when no source matches and there is no fallback", () => {
    expect(resolveMentionSource("T5", [{ prefix: "S" }])).toBeNull();
  });

  it("matches prefixes case-sensitively", () => {
    // lowercase 't' is not the tests prefix, so it falls through to users
    expect(resolveMentionSource("tom", sources)?.prefix).toBe("");
  });
});

describe("parseActiveMention", () => {
  it("detects a bare @ (empty query) against the fallback source", () => {
    const text = "assigned to @";
    const active = parseActiveMention(text, text.length, sources);
    expect(active).toMatchObject({ prefix: "", query: "", start: 12, end: 13 });
  });

  it("detects a prefixed mention and strips the prefix from the query", () => {
    const text = "see @T123";
    const active = parseActiveMention(text, text.length, sources);
    expect(active).toMatchObject({ prefix: "T", query: "123", token: "T123", start: 4 });
  });

  it("parses when the caret is mid-token, not at the end", () => {
    const text = "see @T123 done";
    // caret right after "@T12"
    const active = parseActiveMention(text, 8, sources);
    expect(active).toMatchObject({ prefix: "T", query: "12", end: 8 });
  });

  it("triggers at the very start of the text", () => {
    const active = parseActiveMention("@bob", 4, sources);
    expect(active).toMatchObject({ prefix: "", query: "bob", start: 0 });
  });

  it("does not trigger inside an email (@ not preceded by whitespace)", () => {
    const text = "ping bob@team.io";
    expect(parseActiveMention(text, text.length, sources)).toBeNull();
  });

  it("does not trigger once whitespace follows the @", () => {
    const text = "hello @ world";
    expect(parseActiveMention(text, text.length, sources)).toBeNull();
  });

  it("uses the @ nearest to the caret", () => {
    const text = "@alice and @bob";
    const active = parseActiveMention(text, text.length, sources);
    expect(active).toMatchObject({ query: "bob", start: 11 });
  });

  it("returns null with no sources", () => {
    expect(parseActiveMention("@bob", 4, [])).toBeNull();
  });

  it("returns null when there is no @ before the caret", () => {
    expect(parseActiveMention("plain text", 5, sources)).toBeNull();
  });
});

describe("buildMentionInsertText", () => {
  it("defaults to @{prefix}{id}", () => {
    expect(buildMentionInsertText({ prefix: "T" }, { id: "123456", label: "Login" })).toBe(
      "@T123456",
    );
  });

  it("honors a source insert() override", () => {
    const source: MentionSource = { prefix: "", insert: (item) => `@${item.label}` };
    expect(buildMentionInsertText(source, { id: "u2", label: "bob" })).toBe("@bob");
  });

  it("honors a per-item insertText override", () => {
    expect(
      buildMentionInsertText({ prefix: "T" }, { id: "1", label: "x", insertText: "@custom" }),
    ).toBe("@custom");
  });
});

describe("applyMention", () => {
  it("replaces the token and appends a trailing space", () => {
    const text = "see @T12 here";
    const active = parseActiveMention(text, 8, sources)!;
    const result = applyMention(text, active, "@T123456");
    expect(result.text).toBe("see @T123456 here");
    expect(result.caret).toBe("see @T123456 ".length);
  });

  it("does not double up a space when one already follows", () => {
    const text = "@bob ";
    const active = { start: 0, end: 4 };
    const result = applyMention(text, active, "@bob");
    expect(result.text).toBe("@bob ");
    expect(result.caret).toBe(5);
  });

  it("inserts at the end of the text", () => {
    const text = "assigned to @al";
    const active = parseActiveMention(text, text.length, sources)!;
    const result = applyMention(text, active, "@albert");
    expect(result.text).toBe("assigned to @albert ");
    expect(result.caret).toBe(result.text.length);
  });
});

describe("filterMentionItems", () => {
  it("returns the head of the list for an empty query", () => {
    expect(filterMentionItems(users, "").map((u) => u.label)).toEqual([
      "alice",
      "bob",
      "albert",
    ]);
  });

  it("ranks starts-with above contains", () => {
    // "al" -> alice & albert (starts-with) come before nothing else
    expect(filterMentionItems(users, "al").map((u) => u.label)).toEqual(["alice", "albert"]);
  });

  it("matches case-insensitively", () => {
    expect(filterMentionItems(users, "BOB").map((u) => u.label)).toEqual(["bob"]);
  });

  it("falls back to detail matches", () => {
    expect(filterMentionItems(users, "team.io").length).toBe(3);
  });

  it("respects the limit", () => {
    expect(filterMentionItems(users, "", 2)).toHaveLength(2);
  });
});

describe("normalization", () => {
  it("parses JSON:API resources with varied label attributes", () => {
    const items = parseMentionsFromJsonApi({
      data: [
        { id: 10, type: "test", attributes: { title: "Login redirects", description: "auth" } },
        { id: "u5", type: "user", attributes: { username: "carol", email: "carol@team.io" } },
      ],
    });
    expect(items).toEqual([
      { id: "10", label: "Login redirects", detail: "auth" },
      { id: "u5", label: "carol", detail: "carol@team.io" },
    ]);
  });

  it("drops resources without an id", () => {
    expect(parseMentionsFromJsonApi({ data: [{ attributes: { title: "x" } }] })).toEqual([]);
  });

  it("passes through arrays already shaped as MentionItem[]", () => {
    const raw: MentionItem[] = [{ id: "1", label: "one" }];
    expect(normalizeMentionItems(raw)).toBe(raw);
  });

  it("normalizes a JSON:API array and handles nullish input", () => {
    expect(normalizeMentionItems([{ id: 1, attributes: { name: "n" } }])).toEqual([
      { id: "1", label: "n", detail: null },
    ]);
    expect(normalizeMentionItems(null)).toEqual([]);
    expect(normalizeMentionItems([])).toEqual([]);
  });
});

describe("resolveMentionQuery (main-editor routing)", () => {
  const asyncSources: MentionSource[] = [
    {
      prefix: "T",
      label: "Tests",
      minChars: 1,
      search: async (q) => [{ id: `t-${q}`, label: `Test ${q}` }],
    },
    { prefix: "", label: "Users", items: users, insert: (u) => `@${u.label}` },
  ];

  it("routes a prefixed query to its async source and strips the prefix", async () => {
    const result = await resolveMentionQuery("T123", asyncSources);
    expect(result?.source.prefix).toBe("T");
    expect(result?.items).toEqual([{ id: "t-123", label: "Test 123" }]);
  });

  it("filters the static fallback source for a bare query", async () => {
    const result = await resolveMentionQuery("al", asyncSources);
    expect(result?.source.prefix).toBe("");
    expect(result?.items.map((i) => i.label)).toEqual(["alice", "albert"]);
  });

  it("honors minChars by returning the source with no items", async () => {
    const result = await resolveMentionQuery("T", asyncSources);
    expect(result?.source.prefix).toBe("T");
    expect(result?.items).toEqual([]);
  });

  it("resolves a static provider function once", async () => {
    let calls = 0;
    const provider = () => {
      calls += 1;
      return users;
    };
    const src: MentionSource[] = [{ prefix: "", items: provider }];
    const result = await resolveMentionQuery("bob", src);
    expect(result?.items.map((i) => i.label)).toEqual(["bob"]);
    expect(calls).toBe(1);
  });

  it("returns null when no source matches", async () => {
    expect(await resolveMentionQuery("X1", [{ prefix: "T" }])).toBeNull();
  });
});

describe("global source registry", () => {
  it("stores and clears sources", () => {
    setMentionSources(sources);
    expect(getMentionSources()).toHaveLength(3);
    setMentionSources(null);
    expect(getMentionSources()).toEqual([]);
  });
});

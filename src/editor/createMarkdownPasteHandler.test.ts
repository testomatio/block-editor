import { describe, it, expect, vi, afterEach } from "vitest";
import { createMarkdownPasteHandler } from "./createMarkdownPasteHandler";

// These tests lock in the rendering-performance contract of the paste handler:
// a large paste must NOT build the whole document in one synchronous shot
// (which froze the editor for ~1.6s on a 1000-block document). Only a small
// first chunk is inserted synchronously; the rest is streamed in deferred
// (idle/timeout) batches. They assert behaviour, not wall-clock, so they are
// deterministic and CI-safe.

type Recorded = { content: { text: string }[]; id?: string };

function makeBlocks(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    type: "paragraph",
    content: [{ type: "text", text: `line ${i}`, styles: {} }],
  }));
}

function makeEditor() {
  let idSeq = 0;
  const inserted: Recorded[] = [];
  const assignIds = (blocks: any[]) => blocks.map((b) => ({ ...b, id: `b${idSeq++}` }));

  const editor: any = {
    document: [{ id: "cursor", type: "paragraph", content: [] }],
    getSelection: () => ({ blocks: [] }),
    getTextCursorPosition: () => ({ block: editor.document[0] }),
    replaceBlocks: vi.fn((_ids: string[], blocks: any[]) => {
      const withIds = assignIds(blocks);
      inserted.push(...withIds);
      return { insertedBlocks: withIds, removedBlocks: [] };
    }),
    insertBlocks: vi.fn((blocks: any[]) => {
      const withIds = assignIds(blocks);
      inserted.push(...withIds);
      return withIds;
    }),
    focus: vi.fn(),
  };
  return { editor, inserted };
}

function makeEvent(text: string): any {
  return {
    clipboardData: {
      types: ["text/plain"],
      getData: (type: string) => (type === "text/plain" ? text : ""),
    },
  };
}

const defaultPasteHandler = vi.fn(() => true);

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("createMarkdownPasteHandler — chunked rendering", () => {
  it("inserts a small paste in a single synchronous transaction", () => {
    const N = 20;
    const handler = createMarkdownPasteHandler(() => makeBlocks(N) as any);
    const { editor, inserted } = makeEditor();

    vi.useFakeTimers();
    const result = handler({
      event: makeEvent("a\nb\nc"),
      editor,
      defaultPasteHandler,
    });

    expect(result).toBe(true);
    expect(inserted.length).toBe(N); // everything inserted up front
    expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);
    expect(editor.insertBlocks).not.toHaveBeenCalled(); // nothing deferred
    expect(vi.getTimerCount()).toBe(0); // no background work scheduled
  });

  it("does NOT render a large paste synchronously — only a bounded first chunk", () => {
    const N = 1000;
    const handler = createMarkdownPasteHandler(() => makeBlocks(N) as any);
    const { editor, inserted } = makeEditor();

    vi.useFakeTimers();
    handler({ event: makeEvent("big\npaste"), editor, defaultPasteHandler });

    const syncCount = inserted.length;
    expect(syncCount).toBeGreaterThan(0);
    expect(syncCount).toBeLessThan(N); // the whole doc was NOT built synchronously
    expect(syncCount).toBeLessThanOrEqual(100); // first chunk stays small
    expect(editor.replaceBlocks).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBeGreaterThan(0); // remainder is scheduled, not run
  });

  it("eventually streams in every block exactly once and in order", () => {
    const N = 1000;
    const handler = createMarkdownPasteHandler(() => makeBlocks(N) as any);
    const { editor, inserted } = makeEditor();

    vi.useFakeTimers();
    handler({ event: makeEvent("big\npaste"), editor, defaultPasteHandler });
    vi.runAllTimers(); // flush all deferred batches

    expect(inserted.length).toBe(N);
    inserted.forEach((block, i) => {
      expect(block.content[0].text).toBe(`line ${i}`);
    });

    // Every background batch is bounded — no single batch rebuilds the doc.
    for (const call of editor.insertBlocks.mock.calls) {
      expect((call[0] as any[]).length).toBeLessThanOrEqual(100);
    }
  });

  it("delegates to the default handler when the converter yields nothing", () => {
    const handler = createMarkdownPasteHandler(() => [] as any);
    const { editor } = makeEditor();

    const result = handler({ event: makeEvent("x"), editor, defaultPasteHandler });

    expect(result).toBe(true);
    expect(defaultPasteHandler).toHaveBeenCalled();
    expect(editor.replaceBlocks).not.toHaveBeenCalled();
  });
});

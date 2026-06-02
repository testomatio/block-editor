import type { BlockNoteEditor } from "@blocknote/core";
import type { CustomPartialBlock } from "./customMarkdownConverter";

type PasteHandlerContext = {
  event: ClipboardEvent;
  editor: BlockNoteEditor<any, any, any>;
  defaultPasteHandler: (context?: {
    prioritizeMarkdownOverHTML?: boolean;
    plainTextAsMarkdown?: boolean;
  }) => boolean | undefined;
};

const BLOCK_MARKDOWN_PREFIX = /^(\s*)(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|~~~|\||!\[)/;

// For large pastes, only the first chunk is inserted synchronously (enough to
// fill the viewport); the remaining blocks are streamed in during idle time so
// the editor stays responsive and the user sees content immediately instead of
// the main thread freezing while a thousand-block document is built at once.
const CHUNK_THRESHOLD = 150;
const FIRST_CHUNK = 50;
const REST_CHUNK = 40;

type ScheduleFn = (cb: () => void) => void;

const scheduleIdle: ScheduleFn =
  typeof window !== "undefined" && typeof (window as any).requestIdleCallback === "function"
    ? (cb) => (window as any).requestIdleCallback(() => cb(), { timeout: 200 })
    : (cb) => setTimeout(cb, 0);

function lastBlockId(blocks: Array<{ id?: string }>): string | undefined {
  return blocks.length ? blocks[blocks.length - 1]?.id : undefined;
}

function isInlineOnlyPaste(plainText: string, parsedBlocks: CustomPartialBlock[]): boolean {
  if (parsedBlocks.length !== 1) return false;
  const [block] = parsedBlocks;
  if (block.type !== "paragraph") return false;
  if (block.children && block.children.length > 0) return false;
  if (/\r?\n/.test(plainText)) return false;
  if (BLOCK_MARKDOWN_PREFIX.test(plainText)) return false;
  return true;
}

export function createMarkdownPasteHandler(
  converter: (markdown: string) => CustomPartialBlock[],
) {
  return ({ event, editor, defaultPasteHandler }: PasteHandlerContext): boolean | undefined => {
    const types = event.clipboardData?.types ?? [];

    if (types.includes("blocknote/html")) return defaultPasteHandler();
    if (types.includes("vscode-editor-data")) return defaultPasteHandler();

    if (types.includes("text/html")) {
      const html = event.clipboardData?.getData("text/html") ?? "";
      if (/<(pre|code)[\s>]/i.test(html)) return defaultPasteHandler();
    }

    const cursorBlock = editor.getTextCursorPosition().block;
    if (cursorBlock?.type === "codeBlock" || cursorBlock?.type === "quote" || cursorBlock?.type === "table") return defaultPasteHandler();

    const plainText = event.clipboardData?.getData("text/plain") ?? "";
    if (!plainText.trim()) return defaultPasteHandler();

    try {
      const parsedBlocks = converter(plainText);
      if (parsedBlocks.length === 0) return defaultPasteHandler();

      if (isInlineOnlyPaste(plainText, parsedBlocks)) {
        return defaultPasteHandler({ plainTextAsMarkdown: false });
      }

      const selection = editor.getSelection();
      const selectedIds = selection?.blocks
        ?.map((block: any) => block.id)
        .filter((id: unknown): id is string => Boolean(id)) ?? [];

      // Insert the initial set of blocks at the paste location, returning the
      // inserted blocks so subsequent chunks can be appended after the last one.
      const insertInitial = (
        blocksToInsert: CustomPartialBlock[],
      ): Array<{ id?: string }> | null => {
        if (selectedIds.length > 0) {
          return editor.replaceBlocks(selectedIds, blocksToInsert).insertedBlocks;
        }
        const cursorBlock = editor.getTextCursorPosition().block;
        if (cursorBlock) {
          return editor.replaceBlocks([cursorBlock.id], blocksToInsert).insertedBlocks;
        }
        if (editor.document.length > 0) {
          const reference = editor.document[editor.document.length - 1];
          return editor.insertBlocks(blocksToInsert, reference.id, "after");
        }
        return null;
      };

      if (parsedBlocks.length <= CHUNK_THRESHOLD) {
        // Small paste: insert everything in one transaction (original behaviour).
        if (insertInitial(parsedBlocks) === null) return defaultPasteHandler();
      } else {
        // Large paste: render the first screenful now, stream the rest in idle
        // time so the main thread is never blocked building the whole document.
        const firstChunk = parsedBlocks.slice(0, FIRST_CHUNK);
        const rest = parsedBlocks.slice(FIRST_CHUNK);
        const inserted = insertInitial(firstChunk);
        if (inserted === null) return defaultPasteHandler();

        let anchorId = lastBlockId(inserted);
        let cursor = 0;
        const pump = () => {
          if (!anchorId || cursor >= rest.length) return;
          const batch = rest.slice(cursor, cursor + REST_CHUNK);
          cursor += REST_CHUNK;
          try {
            const insertedBatch = editor.insertBlocks(batch, anchorId, "after");
            anchorId = lastBlockId(insertedBatch) ?? anchorId;
          } catch {
            return; // stop streaming on any structural error
          }
          if (cursor < rest.length) scheduleIdle(pump);
        };
        scheduleIdle(pump);
      }

      editor.focus();
      return true;
    } catch {
      return defaultPasteHandler();
    }
  };
}

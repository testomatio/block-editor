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

      if (selectedIds.length > 0) {
        editor.replaceBlocks(selectedIds, parsedBlocks);
      } else {
        const cursorBlock = editor.getTextCursorPosition().block;
        if (cursorBlock) {
          editor.replaceBlocks([cursorBlock.id], parsedBlocks);
        } else if (editor.document.length > 0) {
          const reference = editor.document[editor.document.length - 1];
          editor.insertBlocks(parsedBlocks, reference.id, "after");
        } else {
          return defaultPasteHandler();
        }
      }

      editor.focus();
      return true;
    } catch {
      return defaultPasteHandler();
    }
  };
}

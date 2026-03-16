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

export function createMarkdownPasteHandler(
  converter: (markdown: string) => CustomPartialBlock[],
) {
  return ({ event, editor, defaultPasteHandler }: PasteHandlerContext): boolean | undefined => {
    const plainText = event.clipboardData?.getData("text/plain") ?? "";
    if (!plainText.trim()) return defaultPasteHandler();

    try {
      const parsedBlocks = converter(plainText);
      if (parsedBlocks.length === 0) return defaultPasteHandler();

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

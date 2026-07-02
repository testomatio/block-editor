import { SuggestionMenuController, useBlockNoteEditor } from "@blocknote/react";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import {
  buildMentionInsertText,
  getMentionSources,
  resolveMentionQuery,
  type MentionSource,
} from "./mentionAutocomplete";

export type MentionMenuProps = {
  /** Sources to use. Falls back to the global registry (`setMentionSources`). */
  sources?: MentionSource[];
  /** Character that opens the menu. Default `@`. */
  triggerCharacter?: string;
};

/**
 * Universal `@`-mention menu for the main BlockNote editor. Render it as a child
 * of `<BlockNoteView>`. On selection it inserts the source's token (e.g.
 * `@T123456`, `@S98765`, `@username`) as inline text at the cursor.
 *
 *   <BlockNoteView editor={editor}>
 *     <MentionMenu />
 *   </BlockNoteView>
 */
export function MentionMenu({ sources: sourcesProp, triggerCharacter = "@" }: MentionMenuProps) {
  const editor = useBlockNoteEditor();

  const getItems = async (query: string): Promise<DefaultReactSuggestionItem[]> => {
    const sources = sourcesProp ?? getMentionSources();
    const resolved = await resolveMentionQuery(query, sources);
    if (!resolved) return [];
    const { source, items } = resolved;
    return items.map((item) => ({
      title: item.label,
      subtext: item.detail ?? undefined,
      onItemClick: () => {
        // The controller has already removed the trigger + query text; we insert
        // the token plus a trailing space so the caret is ready for more typing.
        editor.insertInlineContent([buildMentionInsertText(source, item), " "]);
      },
    }));
  };

  return <SuggestionMenuController triggerCharacter={triggerCharacter} getItems={getItems} />;
}

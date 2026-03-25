import { defaultBlockSpecs } from "@blocknote/core";
import { BlockNoteSchema } from "@blocknote/core";
import { stepBlock } from "./blocks/step";
import { snippetBlock } from "./blocks/snippet";
import { fileBlock } from "./blocks/fileBlock";
import { htmlToMarkdown, markdownToHtml } from "./blocks/markdown";

export const customSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    file: fileBlock,
    testStep: stepBlock,
    snippet: snippetBlock,
  },
});

export type CustomSchema = typeof customSchema;
export type CustomBlock = CustomSchema["Block"];
export type CustomEditor = CustomSchema["BlockNoteEditor"];

export const __markdownTestUtils = {
  markdownToHtml,
  htmlToMarkdown,
};

export {
  customSchema,
  type CustomSchema,
  type CustomBlock,
  type CustomEditor,
} from "./editor/customSchema";
export { stepBlock, canInsertStepOrSnippet, isStepsHeading, addStepsBlock, addSnippetBlock } from "./editor/blocks/step";
export { snippetBlock } from "./editor/blocks/snippet";
export { markdownToHtml, htmlToMarkdown } from "./editor/blocks/markdown";

export {
  blocksToMarkdown,
  markdownToBlocks,
  type CustomEditorBlock,
  type CustomPartialBlock,
  type MarkdownToBlocksOptions,
} from "./editor/customMarkdownConverter";

export {
  useStepAutocomplete,
  parseStepsFromJsonApi,
  setStepsFetcher,
  type StepSuggestion,
  type StepJsonApiDocument,
  type StepJsonApiResource,
} from "./editor/stepAutocomplete";

export {
  useStepImageUpload,
  setImageUploadHandler,
  type StepImageUploadHandler,
} from "./editor/stepImageUpload";

export {
  setFileDisplayUrlResolver,
  resolveFileDisplayUrl,
  type FileDisplayUrlResolver,
} from "./editor/fileDisplayUrl";

export { createMarkdownPasteHandler } from "./editor/createMarkdownPasteHandler";

export const testomatioEditorClassName = "markdown testomatio-editor";

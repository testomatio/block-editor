export {
  customSchema,
  type CustomSchema,
  type CustomBlock,
  type CustomEditor,
} from "./editor/customSchema";
export { stepBlock, canInsertStepOrSnippet, isStepsHeading } from "./editor/blocks/step";
export { snippetBlock } from "./editor/blocks/snippet";
export { markdownToHtml, htmlToMarkdown } from "./editor/blocks/markdown";

export {
  blocksToMarkdown,
  markdownToBlocks,
  type CustomEditorBlock,
  type CustomPartialBlock,
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

export { createMarkdownPasteHandler } from "./editor/createMarkdownPasteHandler";

export const testomatioEditorClassName = "markdown testomatio-editor";

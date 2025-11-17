export {
  customSchema,
  type CustomSchema,
  type CustomBlock,
  type CustomEditor,
} from "./editor/customSchema";

export {
  blocksToMarkdown,
  markdownToBlocks,
  type CustomEditorBlock,
  type CustomPartialBlock,
} from "./editor/customMarkdownConverter";

export {
  useStepAutocomplete,
  parseStepsFromJsonApi,
  setGlobalStepSuggestionsFetcher,
  type StepSuggestion,
  type StepJsonApiDocument,
  type StepJsonApiResource,
} from "./editor/stepAutocomplete";

export {
  useStepImageUpload,
  setImageUploadHandler,
  type StepImageUploadHandler,
} from "./editor/stepImageUpload";

export const testomatioEditorClassName = "markdown testomatio-editor";

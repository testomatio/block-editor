export {
  customSchema,
  type CustomSchema,
  type CustomBlock,
  type CustomEditor,
} from "./editor/customSchema";
export { stepBlock, canInsertStepOrSnippet, isStepsHeading, addStepsBlock, addSnippetBlock } from "./editor/blocks/step";
export { snippetBlock } from "./editor/blocks/snippet";
export { testMetaBlock, addTestBlock } from "./editor/blocks/testMeta";
export {
  setMetaFieldSuggestions,
  getMetaFieldSuggestions,
  type MetaFieldSuggestion,
  type MetaFieldSuggestionsConfig,
} from "./editor/testMetaFields";
export { markdownToHtml, htmlToMarkdown } from "./editor/blocks/markdown";

export {
  tagBadgeExtension,
  TagBadgeExtension,
  TAGS_DETECT_REGEXP,
  detectTags,
  type TagMatch,
} from "./editor/tagBadge";

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
  setMentionSources,
  getMentionSources,
  parseActiveMention,
  resolveMentionSource,
  buildMentionInsertText,
  applyMention,
  filterMentionItems,
  resolveMentionQuery,
  normalizeMentionItems,
  parseMentionsFromJsonApi,
  type MentionSource,
  type MentionItem,
  type MentionItemsInput,
  type MentionSearchResult,
  type ActiveMention,
  type MentionJsonApiDocument,
  type MentionJsonApiResource,
} from "./editor/mentionAutocomplete";

export {
  MentionMenu,
  type MentionMenuProps,
} from "./editor/MentionMenu";

export {
  useMentionAutocomplete,
  type UseMentionAutocompleteOptions,
  type UseMentionAutocompleteResult,
} from "./editor/MentionAutocomplete";

export {
  setFileDisplayUrlResolver,
  resolveFileDisplayUrl,
  type FileDisplayUrlResolver,
} from "./editor/fileDisplayUrl";

export { createMarkdownPasteHandler } from "./editor/createMarkdownPasteHandler";

export const testomatioEditorClassName = "markdown testomatio-editor";

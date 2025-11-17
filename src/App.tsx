import { useEffect, useMemo, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import {
  useCreateBlockNote,
  useEditorChange,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useBlockNoteEditor,
} from "@blocknote/react";
import {
  filterSuggestionItems,
  insertOrUpdateBlock,
} from "@blocknote/core";
import {
  blocksToMarkdown,
  markdownToBlocks,
  type CustomEditorBlock,
  type CustomPartialBlock,
} from "./editor/customMarkdownConverter";
import { customSchema, type CustomEditor } from "./editor/customSchema";
import { setGlobalStepSuggestionsFetcher, type StepJsonApiDocument } from "./editor/stepAutocomplete";
import { setImageUploadHandler } from "./editor/stepImageUpload";
import "./App.css";

const focusTestStepTitle = (editor: CustomEditor | null | undefined, blockId?: string) => {
  if (!editor || !blockId) {
    return;
  }

  const focus = () => {
    const stepTitle = document.querySelector<HTMLElement>(
      `[data-block-id="${blockId}"] [data-step-field="title"]`,
    );

    if (stepTitle) {
      stepTitle.focus();
      return;
    }

    editor.setSelection(blockId, blockId);
    editor.setTextCursorPosition(blockId, "end");
    editor.focus();
  };

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(focus);
    return;
  }

  setTimeout(focus, 0);
};

type Schema = typeof customSchema;

const DEFAULT_BLOCK_PROPS = {
  textAlignment: "left" as const,
  textColor: "default" as const,
  backgroundColor: "default" as const,
};

const DEMO_STEP_FIXTURES: StepJsonApiDocument = {
  data: [
    {
      id: "145",
      type: "step",
      attributes: {
        labels: [],
        title: "Donec placerat, dui vitae",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 23,
        "comments-count": 0,
      },
    },
    {
      id: "146",
      type: "step",
      attributes: {
        labels: [],
        title: "Ut auctor mi erat ac dolor.",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 23,
        "comments-count": 0,
      },
    },
    {
      id: "147",
      type: "step",
      attributes: {
        labels: [],
        title: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit.",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 23,
        "comments-count": 0,
      },
    },
    {
      id: "148",
      type: "step",
      attributes: {
        labels: [],
        title: "Felis libero varius orci, in vulputate",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 19,
        "comments-count": 0,
      },
    },
    {
      id: "149",
      type: "step",
      attributes: {
        labels: [],
        title: "Massa turpis scelerisque diam.",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 19,
        "comments-count": 0,
      },
    },
    {
      id: "150",
      type: "step",
      attributes: {
        labels: [],
        title: "Nunc et felis est. Phasellus laoreet nibh vel augue",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 19,
        "comments-count": 0,
      },
    },
    {
      id: "151",
      type: "step",
      attributes: {
        labels: [],
        title: "Suspendisse interdum sem non sem cursus consequat.",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 17,
        "comments-count": 0,
      },
    },
    {
      id: "152",
      type: "step",
      attributes: {
        labels: [],
        title: "Aliquam tempor, nibh sed facilisis lacinia, nisl velit aliquet nunc.",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 16,
        "comments-count": 0,
      },
    },
    {
      id: "153",
      type: "step",
      attributes: {
        labels: [],
        title: "Praesent tellus neque, efficitur vel hendrerit sed, porta id sapien.",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 14,
        "comments-count": 0,
      },
    },
    {
      id: "154",
      type: "step",
      attributes: {
        labels: [],
        title: "Maecenas suscipit lacus vitae viverra fermentum.",
        kind: "manual",
        description: null,
        keywords: [],
        "is-snippet": null,
        "usage-count": 12,
        "comments-count": 0,
      },
    },
  ],
};

function CustomSlashMenu() {
  const editor = useBlockNoteEditor<Schema["blockSchema"], Schema["inlineContentSchema"], Schema["styleSchema"]>();

  if (!editor) {
    return null;
  }

  const getItems = async (query: string) => {
    const defaultItems = getDefaultReactSlashMenuItems(editor);

    const stepItem = {
      key: "test_step" as any,
      title: "Test Step",
      subtext: "Capture an action with its expected result",
      group: "Test documentation",
      icon: <span className="bn-suggestion-icon">TS</span>,
      aliases: ["step", "test step", "expected"],
      onItemClick: () => {
        const inserted = insertOrUpdateBlock(editor, {
          type: "testStep",
          props: {
            stepTitle: "",
            stepData: "",
            expectedResult: "",
          },
        });
        focusTestStepTitle(editor, inserted.id);
      },
    };

    return filterSuggestionItems([...defaultItems, stepItem], query);
  };

  return <SuggestionMenuController triggerCharacter="/" getItems={getItems} />;
}

function App() {
  const editor = useCreateBlockNote({
    schema: customSchema,
    pasteHandler: ({ event, editor, defaultPasteHandler }) => {
      const plainText = event.clipboardData?.getData("text/plain") ?? "";

      if (!plainText.trim()) {
        return defaultPasteHandler();
      }

      try {
        const parsedBlocks = markdownToBlocks(plainText);

        if (parsedBlocks.length === 0) {
          return defaultPasteHandler();
        }

        const selection = editor.getSelection();
        const selectedIds = selection?.blocks
          ?.map((block) => block.id)
          .filter((id): id is string => Boolean(id)) ?? [];

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
      } catch (error) {
        console.error("Failed to paste custom markdown", error);
        return defaultPasteHandler();
      }
    },
  });
  const [markdown, setMarkdown] = useState("");
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [blocksJson, setBlocksJson] = useState("[]");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const [copyBlocksStatus, setCopyBlocksStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEditorChange((editorInstance) => {
    try {
      const documentBlocks = editorInstance.document as CustomEditorBlock[];
      const md = blocksToMarkdown(documentBlocks);
      setMarkdown(md);
      setBlocksJson(JSON.stringify(documentBlocks, null, 2));
      setConversionError(null);
      setCopyStatus("idle");
      setCopyBlocksStatus("idle");
    } catch (error) {
      setConversionError(error instanceof Error ? error.message : String(error));
      setCopyStatus("idle");
      setCopyBlocksStatus("idle");
    }
  }, editor);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const unsubscribe = editor.onChange((instance, context) => {
      const changes = context.getChanges();
      const newlyInsertedStep = changes.find(({ type, block, source }) => {
        if (type !== "insert") {
          return false;
        }

        if (source?.type === "yjs-remote") {
          return false;
        }

        return block.type === "testStep" && ((block.props as any)?.stepTitle ?? "") === "";
      });

      if (newlyInsertedStep) {
        focusTestStepTitle(instance, newlyInsertedStep.block.id);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [editor]);

  const uploadStepImage = useMemo(
    () => async (_image: Blob) => ({ url: `https://placehold.co/600x400?text=Uploaded+${Date.now()}` }),
    [],
  );

  useEffect(() => {
    // Demo defaults: configure global handlers so the editor works without manual providers.
    setGlobalStepSuggestionsFetcher(() => DEMO_STEP_FIXTURES);

    const handler = editor?.uploadFile
      ? async (file: Blob) => {
          const result = await editor.uploadFile!(file as File);
          if (typeof result === "string") {
            return { url: result };
          }
          if (result && typeof result === "object" && "url" in result && typeof (result as any).url === "string") {
            return { url: (result as any).url as string };
          }
          throw new Error("uploadFile did not return a URL");
        }
      : uploadStepImage;

    setImageUploadHandler(handler);

    return () => {
      setGlobalStepSuggestionsFetcher(null);
      setImageUploadHandler(null);
    };
  }, [editor, uploadStepImage]);

  const createTestCaseBlock = useMemo<() => CustomPartialBlock>(() => {
    return () => ({
      type: "testCase",
      props: {
        ...DEFAULT_BLOCK_PROPS,
        status: "draft",
        reference: "",
      },
      content: [
        {
          type: "text",
          text: "Write the expected result, steps, and assertions here…",
          styles: {},
        },
      ],
      children: [],
    });
  }, []);

  const createTestStepBlock = useMemo<() => CustomPartialBlock>(() => {
    return () => ({
      type: "testStep",
      props: {
        stepTitle: "",
        stepData: "",
        expectedResult: "",
      },
      children: [],
    });
  }, []);

  const insertBlockAfterSelection = (createBlock: () => CustomPartialBlock) => {
    const selection = editor.getSelection();
    const selectedBlocks = selection?.blocks ?? [];
    const selectedBlock = selectedBlocks[selectedBlocks.length - 1];
    const documentBlocks = editor.document;
    const fallbackBlock = documentBlocks[documentBlocks.length - 1];
    const referenceId = selectedBlock?.id ?? fallbackBlock?.id;

    if (!referenceId) {
      return;
    }

    const inserted = editor.insertBlocks([createBlock()], referenceId, "after");
    const firstInserted = inserted[0];
    if (firstInserted) {
      focusTestStepTitle(editor, firstInserted.id);
    }
  };

  const insertTestCase = () => insertBlockAfterSelection(createTestCaseBlock);
  const insertTestStep = () => insertBlockAfterSelection(createTestStepBlock);

  const handleCopyMarkdown = async () => {
    if (conversionError) {
      return;
    }

    try {
      if (
        typeof navigator !== "undefined" &&
        navigator?.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(markdown);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = markdown;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopyStatus("copied");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setCopyStatus("idle"), 2000);
      }
    } catch (error) {
      console.error("Failed to copy markdown", error);
      setCopyStatus("failed");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setCopyStatus("idle"), 2000);
      }
    }
  };

  const handleCopyBlocks = async () => {
    if (conversionError) {
      return;
    }

    try {
      if (
        typeof navigator !== "undefined" &&
        navigator?.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(blocksJson);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = blocksJson;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopyBlocksStatus("copied");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setCopyBlocksStatus("idle"), 2000);
      }
    } catch (error) {
      console.error("Failed to copy block JSON", error);
      setCopyBlocksStatus("failed");
      if (typeof window !== "undefined") {
        window.setTimeout(() => setCopyBlocksStatus("idle"), 2000);
      }
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>BlockNote Custom Block Playground</h1>
          <p>
            Explore custom blocks for documenting test cases and actionable steps, then convert the document to Markdown using a bespoke serializer.
          </p>
        </div>
        <div className="app__actions">
          <button type="button" className="app__action" onClick={insertTestStep}>
            Insert Step
          </button>
          <button
            type="button"
            className="app__action app__action--ghost"
            onClick={insertTestCase}
          >
            Insert Test Case
          </button>
        </div>
      </header>

      <section className="app__workspace">
        <div className="app__editor">
          <BlockNoteView
            editor={editor}
            theme="light"
            slashMenu={false}
            className="markdown testomatio-editor"
          >
            <CustomSlashMenu />
          </BlockNoteView>
        </div>
        <aside className="app__preview">
          <div className="app__panel">
            <div className="app__panel-header">
              <h2>Markdown Preview</h2>
              <div className="app__copy">
                <button
                  type="button"
                  className="app__action app__action--ghost"
                  onClick={handleCopyMarkdown}
                  disabled={!!conversionError || markdown.length === 0}
                  title="Copy Markdown"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                </button>
                {copyStatus === "copied" && (
                  <span className="app__copy-status">Copied!</span>
                )}
                {copyStatus === "failed" && (
                  <span className="app__copy-status app__copy-status--error">
                    Copy failed
                  </span>
                )}
              </div>
            </div>
            {conversionError ? (
              <p className="app__error">{conversionError}</p>
            ) : (
              <pre>{markdown}</pre>
            )}
          </div>
          <div className="app__panel app__panel--light">
            <div className="app__panel-header">
              <h2>Autocomplete Steps</h2>
            </div>
            <p className="app__panel-text">
              Start typing in the Step Title field to filter this list instantly.
            </p>
            <ol className="app__step-list">
              {(DEMO_STEP_FIXTURES.data ?? []).map((step) => (
                <li key={step.id ?? step.attributes?.title}>
                  <span className="app__step-title">{step.attributes?.title}</span>
                  {typeof step.attributes?.["usage-count"] === "number" && (
                    <span className="app__step-meta">{step.attributes?.["usage-count"]} uses</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div className="app__panel">
            <div className="app__panel-header">
              <h2>Blocks JSON</h2>
              <div className="app__copy">
                <button
                  type="button"
                  className="app__action app__action--ghost"
                  onClick={handleCopyBlocks}
                  disabled={!!conversionError || blocksJson.length === 0}
                  title="Copy Blocks"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                </button>
                {copyBlocksStatus === "copied" && (
                  <span className="app__copy-status">Copied!</span>
                )}
                {copyBlocksStatus === "failed" && (
                  <span className="app__copy-status app__copy-status--error">
                    Copy failed
                  </span>
                )}
              </div>
            </div>
            <pre>{blocksJson}</pre>
          </div>
        </aside>
      </section>
    </div>
  );
}

export default App;

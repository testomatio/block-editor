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
import { flip, offset, shift, size } from "@floating-ui/react";
import {
  blocksToMarkdown,
  markdownToBlocks,
  type CustomEditorBlock,

} from "./editor/customMarkdownConverter";
import { createMarkdownPasteHandler } from "./editor/createMarkdownPasteHandler";
import { customSchema, type CustomEditor } from "./editor/customSchema";
import { setStepsFetcher, type StepJsonApiDocument } from "./editor/stepAutocomplete";
import { setSnippetFetcher, type SnippetJsonApiDocument } from "./editor/snippetAutocomplete";
import { setImageUploadHandler } from "./editor/stepImageUpload";
import { canInsertStepOrSnippet, addStepsBlock, addSnippetBlock } from "./editor/blocks/step";
import "./App.css";

const focusStepField = (
  editor: CustomEditor | null | undefined,
  blockId?: string,
  fieldName = "title",
) => {
  if (!editor || !blockId) {
    return;
  }

  const focus = () => {
    const stepTitle = document.querySelector<HTMLElement>(
      `[data-block-id="${blockId}"] [data-step-field="${fieldName}"]`,
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
    {
      id: "301",
      type: "step",
      attributes: {
        labels: ["snippet"],
        title: "Open login page and wait for ready state",
        kind: "snippet",
        description: "Reusable login navigation snippet",
        keywords: ["login", "auth"],
        "is-snippet": true,
        "usage-count": 41,
        "comments-count": 2,
      },
    },
    {
      id: "302",
      type: "step",
      attributes: {
        labels: ["snippet"],
        title: "Fill credentials with provided user object",
        kind: "snippet",
        description: "Populate form fields from test data",
        keywords: ["form", "user"],
        "is-snippet": true,
        "usage-count": 35,
        "comments-count": 1,
      },
    },
    {
      id: "303",
      type: "step",
      attributes: {
        labels: ["snippet"],
        title: "Verify toast message disappears",
        kind: "snippet",
        description: "Shared assertion for ephemeral UI",
        keywords: ["toast", "assertion"],
        "is-snippet": true,
        "usage-count": 18,
        "comments-count": 0,
      },
    },
  ],
};

const DEMO_SNIPPET_FIXTURES: SnippetJsonApiDocument = {
  data: [
    {
      id: "501",
      type: "snippet",
      attributes: {
        title: "Login setup",
        body: "Open /login\nWait for form to render\nEnsure no console errors",
        description: "Navigate to login and wait for readiness",
        "usage-count": 12,
        "is-snippet": true,
      },
    },
    {
      id: "502",
      type: "snippet",
      attributes: {
        title: "Fill credentials",
        body: "Type email\nType password\nClick Sign In",
        description: "Reusable credentials filler",
        "usage-count": 9,
        "is-snippet": true,
      },
    },
    {
      id: "503",
      type: "snippet",
      attributes: {
        title: "Verify toast disappears",
        body: "Assert toast visible\nWait 3s\nAssert toast removed",
        description: "Shared assertion for ephemeral notifications",
        "usage-count": 7,
        "is-snippet": true,
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
    const isMac =
      typeof navigator !== "undefined" &&
      (/Mac/.test(navigator.platform) ||
        (/AppleWebKit/.test(navigator.userAgent) &&
          /Mobile\/\w+/.test(navigator.userAgent)));

    const defaultItems = getDefaultReactSlashMenuItems(editor).map((item) => {
      if (item.badge && isMac) {
        return { ...item, badge: item.badge.replace("Alt", "Option") };
      }
      return item;
    });

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
        focusStepField(editor, inserted.id, "title");
      },
    };

    const snippetItem = {
      key: "snippet" as any,
      title: "Snippet",
      subtext: "Insert a reusable snippet with data and an expected result",
      group: "Test documentation",
      icon: <span className="bn-suggestion-icon">SN</span>,
      aliases: ["snippet", "reusable step"],
      onItemClick: () => {
        const inserted = insertOrUpdateBlock(editor, {
          type: "snippet",
          props: {
            snippetId: "",
            snippetTitle: "",
            snippetData: "",
            snippetExpectedResult: "",
          },
        });
        focusStepField(editor, inserted.id, "snippet-title");
      },
    };

    const currentBlock = editor.getTextCursorPosition().block;
    const canInsert = canInsertStepOrSnippet(editor, currentBlock.id);
    const items = canInsert
      ? [...defaultItems, stepItem, snippetItem]
      : defaultItems;
    return filterSuggestionItems(items, query);
  };

  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={getItems}
      floatingOptions={{
        middleware: [
          offset(10),
          size({
            apply({ elements }) {
              Object.assign(elements.floating.style, { maxHeight: "", overflowY: "" });
            },
          }),
          flip({
            padding: 10,
            fallbackPlacements: ["top-start"],
          }),
          shift({ padding: 10 }),
          {
            name: "fitToViewport",
            fn({ y, rects, elements }) {
              const padding = 10;
              if (y < padding) {
                const bottomEdge = rects.reference.y - 10;
                const maxHeight = Math.max(bottomEdge - padding, 100);
                Object.assign(elements.floating.style, {
                  maxHeight: `${maxHeight}px`,
                  overflowY: "auto",
                });
                return { y: padding };
              }
              const viewportHeight = window.innerHeight;
              const available = viewportHeight - y - padding;
              Object.assign(elements.floating.style, {
                maxHeight: `${Math.max(available, 100)}px`,
                overflowY: "auto",
              });
              return {};
            },
          },
        ],
      }}
    />
  );
}

function App() {
  const editor = useCreateBlockNote({
    schema: customSchema,
    pasteHandler: createMarkdownPasteHandler(markdownToBlocks),
    uploadFile: async (file: File) => {
      const url = `https://placehold.co/600x400?text=${encodeURIComponent(file.name)}`;
      return {
        props: {
          url,
          name: file.name,
        },
      };
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
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

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
      const newlyInsertedAction = changes.find(({ type, block, source }) => {
        if (type !== "insert") {
          return false;
        }

        if (source?.type === "yjs-remote") {
          return false;
        }

        if (block.type === "testStep") {
          return ((block.props as any)?.stepTitle ?? "") === "";
        }

        if (block.type === "snippet") {
          return ((block.props as any)?.snippetTitle ?? "") === "";
        }

        return false;
      });

      if (newlyInsertedAction) {
        const fieldName = newlyInsertedAction.block.type === "snippet" ? "snippet-title" : "title";
        focusStepField(instance, newlyInsertedAction.block.id, fieldName);
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
    setStepsFetcher(() => DEMO_STEP_FIXTURES);
    setSnippetFetcher(() => DEMO_SNIPPET_FIXTURES);

    const handler = editor?.uploadFile
      ? async (file: Blob) => {
          const result = await editor.uploadFile!(file as File);
          if (typeof result === "string") {
            return { url: result };
          }
          if (result && typeof result === "object") {
            if ("url" in result && typeof (result as any).url === "string") {
              return { url: (result as any).url as string };
            }
            const propsUrl = (result as any).props?.url;
            if (typeof propsUrl === "string") {
              return { url: propsUrl };
            }
          }
          throw new Error("uploadFile did not return a URL");
        }
      : uploadStepImage;

    setImageUploadHandler(handler);

    return () => {
      setStepsFetcher(null);
      setSnippetFetcher(null);
      setImageUploadHandler(null);
    };
  }, [editor, uploadStepImage]);

  const insertTestStep = () => {
    const id = addStepsBlock(editor);
    if (id) focusStepField(editor, id, "title");
  };
  const insertSnippet = () => {
    const id = addSnippetBlock(editor);
    if (id) focusStepField(editor, id, "snippet-title");
  };

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
            onClick={insertSnippet}
          >
            Insert Snippet
          </button>
          <button
            type="button"
            className="app__dark-toggle"
            onClick={() => setDarkMode((v) => !v)}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>
      </header>

      <section className="app__workspace">
        <div className="app__editor">
          <BlockNoteView
            editor={editor}
            theme={darkMode ? "dark" : "light"}
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
              Markdown format supported
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

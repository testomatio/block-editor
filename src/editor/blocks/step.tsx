import { createReactBlockSpec, useEditorChange } from "@blocknote/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StepField, StepFieldPreview } from "./stepField";
import { StepHorizontalView } from "./stepHorizontalView";
import { useStepImageUpload } from "../stepImageUpload";
import type { StepSuggestion } from "../stepAutocomplete";

const EXPECTED_COLLAPSED_KEY = "bn-expected-collapsed";
const VIEW_MODE_KEY = "bn-step-view-mode";
const STEP_TITLE_PLACEHOLDER = "Enter step title...";
const STEP_DATA_PLACEHOLDER = "Enter step data...";
const EXPECTED_RESULT_PLACEHOLDER = "Enter expected result...";
type StepViewMode = "vertical" | "horizontal" | "compact";
const FORCE_VERTICAL_WIDTH = 550;

/* readExpectedCollapsedPreference removed — currently unused */

const writeExpectedCollapsedPreference = (collapsed: boolean) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(EXPECTED_COLLAPSED_KEY, collapsed ? "true" : "false");
  } catch {
    //
  }
};

const readStepViewMode = (): StepViewMode => {
  if (typeof window === "undefined") {
    return "vertical";
  }
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    return stored === "horizontal" || stored === "compact" ? stored : "vertical";
  } catch {
    return "vertical";
  }
};

const writeStepViewMode = (mode: StepViewMode) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    //
  }
};

/**
 * Subscribes to the globally-shared step view mode. The mode lives in
 * localStorage and changes are broadcast via the `bn-step-view-mode` event
 * (same tab) and the `storage` event (other tabs), so toggling it on any step
 * re-renders every step — including the read-only previews — into the new mode.
 */
function useStepViewMode(): StepViewMode {
  const [viewMode, setViewMode] = useState<StepViewMode>(() => readStepViewMode());
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === VIEW_MODE_KEY) {
        setViewMode(readStepViewMode());
      }
    };
    const handleLocal = () => {
      setViewMode(readStepViewMode());
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("bn-step-view-mode", handleLocal as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("bn-step-view-mode", handleLocal as EventListener);
    };
  }, []);
  return viewMode;
}

/**
 * Returns true when a normalised (lowercased, trailing-punctuation-stripped)
 * heading text looks like a "Steps" heading.
 * Accepted forms: steps, step, step(s), test steps, test step, test step(s).
 */
export function isStepsHeading(text: string): boolean {
  return /^(test\s+)?step(s|\(s\))?$/.test(text);
}

export const isEmptyParagraph = (b: any): boolean =>
  b.type === "paragraph" &&
  (!Array.isArray(b.content) ||
    b.content.length === 0 ||
    b.content.every((n: any) => n.type === "text" && !n.text?.trim()));

/**
 * Check whether a step or snippet can be inserted at / after the given block.
 * Returns true only when walking backwards from `referenceBlockId` (skipping
 * other steps, snippets, and empty paragraphs) reaches a heading whose text
 * is "steps".
 */
export function canInsertStepOrSnippet(
  editor: { document: any[] },
  referenceBlockId: string,
): boolean {
  const allBlocks = editor.document;
  const blockIndex = allBlocks.findIndex((b: any) => b.id === referenceBlockId);
  if (blockIndex < 0) return false;

  for (let i = blockIndex; i >= 0; i--) {
    const b = allBlocks[i];
    if (b.type === "testStep" || b.type === "snippet" || isEmptyParagraph(b)) {
      continue;
    }
    if (b.type === "heading") {
      const text = (Array.isArray(b.content) ? b.content : [])
        .filter((n: any) => n.type === "text")
        .map((n: any) => n.text ?? "")
        .join("")
        .trim()
        .toLowerCase()
        .replace(/[:\-–—]$/, "");
      return isStepsHeading(text);
    }
    return false;
  }
  return false;
}

/**
 * Programmatically add an empty step block to the editor.
 * - If a "Steps" heading exists, inserts after the last step/snippet under it.
 * - Otherwise, appends a "Steps" heading + empty step at the end.
 * Returns the inserted step's block ID (for focusing), or null.
 */
export function addStepsBlock(editor: {
  document: any[];
  insertBlocks: (blocks: any[], referenceId: string, placement: "before" | "after") => any[];
}): string | null {
  const allBlocks = editor.document;

  let stepsHeadingIndex = -1;
  for (let i = 0; i < allBlocks.length; i++) {
    const b = allBlocks[i];
    if (b.type !== "heading") continue;
    const text = (Array.isArray(b.content) ? b.content : [])
      .filter((n: any) => n.type === "text")
      .map((n: any) => n.text ?? "")
      .join("")
      .trim()
      .toLowerCase()
      .replace(/[:\-–—]$/, "");
    if (isStepsHeading(text)) {
      stepsHeadingIndex = i;
      break;
    }
  }

  if (stepsHeadingIndex >= 0) {
    let lastIndex = stepsHeadingIndex;
    for (let i = stepsHeadingIndex + 1; i < allBlocks.length; i++) {
      const b = allBlocks[i];
      if (b.type === "testStep" || b.type === "snippet") {
        lastIndex = i;
        continue;
      }
      if (isEmptyParagraph(b)) continue;
      break;
    }
    const previousStep = allBlocks[lastIndex];
    const inheritedListStyle =
      previousStep?.type === "testStep"
        ? ((previousStep.props as any)?.listStyle ?? "bullet")
        : "bullet";
    const emptyStep = {
      type: "testStep" as const,
      props: { stepTitle: "", stepData: "", expectedResult: "", listStyle: inheritedListStyle },
      children: [],
    };
    const inserted = editor.insertBlocks([emptyStep], previousStep.id, "after");
    return inserted?.[0]?.id ?? null;
  }

  const lastBlock = allBlocks[allBlocks.length - 1];
  const stepsHeading = {
    type: "heading" as const,
    props: { level: 3 },
    content: [{ type: "text" as const, text: "Steps" }],
    children: [],
  };
  const emptyStep = {
    type: "testStep" as const,
    props: { stepTitle: "", stepData: "", expectedResult: "" },
    children: [],
  };
  const inserted = editor.insertBlocks([stepsHeading, emptyStep], lastBlock.id, "after");
  return inserted?.[1]?.id ?? null;
}

/**
 * Programmatically add an empty snippet block to the editor.
 * - If a "Steps" heading exists, inserts after the last step/snippet under it.
 * - Otherwise, appends a "Steps" heading + empty snippet at the end.
 * Returns the inserted snippet's block ID (for focusing), or null.
 */
export function addSnippetBlock(editor: {
  document: any[];
  insertBlocks: (blocks: any[], referenceId: string, placement: "before" | "after") => any[];
}): string | null {
  const allBlocks = editor.document;
  const emptySnippet = {
    type: "snippet" as const,
    props: { snippetId: "", snippetTitle: "", snippetData: "", snippetExpectedResult: "" },
    children: [],
  };

  let stepsHeadingIndex = -1;
  for (let i = 0; i < allBlocks.length; i++) {
    const b = allBlocks[i];
    if (b.type !== "heading") continue;
    const text = (Array.isArray(b.content) ? b.content : [])
      .filter((n: any) => n.type === "text")
      .map((n: any) => n.text ?? "")
      .join("")
      .trim()
      .toLowerCase()
      .replace(/[:\-–—]$/, "");
    if (isStepsHeading(text)) {
      stepsHeadingIndex = i;
      break;
    }
  }

  if (stepsHeadingIndex >= 0) {
    let lastIndex = stepsHeadingIndex;
    for (let i = stepsHeadingIndex + 1; i < allBlocks.length; i++) {
      const b = allBlocks[i];
      if (b.type === "testStep" || b.type === "snippet") {
        lastIndex = i;
        continue;
      }
      if (isEmptyParagraph(b)) continue;
      break;
    }
    const inserted = editor.insertBlocks([emptySnippet], allBlocks[lastIndex].id, "after");
    return inserted?.[0]?.id ?? null;
  }

  const lastBlock = allBlocks[allBlocks.length - 1];
  const stepsHeading = {
    type: "heading" as const,
    props: { level: 3 },
    content: [{ type: "text" as const, text: "Steps" }],
    children: [],
  };
  const inserted = editor.insertBlocks([stepsHeading, emptySnippet], lastBlock.id, "after");
  return inserted?.[1]?.id ?? null;
}

/**
 * A test step's 1-based position within its group: count back over preceding
 * steps (blank lines don't break the run) until a non-step block.
 */
export function computeStepNumber(allBlocks: any[], blockId: string): number {
  const blockIndex = allBlocks.findIndex((b) => b.id === blockId);
  if (blockIndex < 0) return 1;

  let count = 1;
  for (let i = blockIndex - 1; i >= 0; i--) {
    const b = allBlocks[i];
    if (b.type === "testStep") {
      count++;
    } else if (isEmptyParagraph(b)) {
      continue;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Read-only stand-in rendered for every step that isn't currently being edited.
 * It mirrors the live step's structure for the active view mode and renders each
 * field via {@link StepFieldPreview} — a faithful, formatted reading view with
 * no OverType editor. Only the focused step ever mounts an editor, so scrolling
 * never mounts/tears down editors and the list stays flicker-free.
 *
 * Field visibility is gated on the raw trimmed props (matching the live step's
 * `isDataVisible`/`isExpectedVisible`) so the same fields appear in both states.
 */
function TestStepPreview({
  blockId,
  stepNumber,
  viewMode,
  stepTitle,
  stepData,
  expectedResult,
}: {
  blockId: string;
  stepNumber: number;
  viewMode: StepViewMode;
  stepTitle: string;
  stepData: string;
  expectedResult: string;
}) {
  const compactMode = viewMode === "compact";
  const hasData = stepData.trim().length > 0;
  const hasExpected = expectedResult.trim().length > 0;

  return (
    <div
      className={`bn-teststep${compactMode ? " bn-teststep--compact bn-teststep--collapsed" : ""}`}
      data-block-id={blockId}
    >
      <div className="bn-teststep__timeline">
        <span className="bn-teststep__number">{stepNumber}</span>
        <div className="bn-teststep__line" />
      </div>
      <div className="bn-teststep__content">
        {!compactMode && (
          <div className="bn-teststep__header">
            <span className="bn-teststep__title">Step</span>
          </div>
        )}
        <StepFieldPreview value={stepTitle} fieldName="title" />
        {hasData ? <StepFieldPreview value={stepData} fieldName="data" /> : null}
        {hasExpected ? <StepFieldPreview value={expectedResult} fieldName="expected" /> : null}
      </div>
    </div>
  );
}

/**
 * Wrapper that mounts the (expensive) interactive step editor only while the
 * step is being edited. Every other step renders the read-only
 * {@link TestStepPreview}, so a document of any size keeps at most one OverType
 * editor alive — scrolling never mounts or tears down editors, which is what
 * keeps the list flicker-free (and pasting/loading a large document fast).
 *
 * The step number is tracked here and pushed down as a prop. We subscribe to
 * editor changes but bail out of re-rendering when the number is unchanged, so
 * ordinary text edits don't re-render every step in the document.
 */
function TestStepBlock({ block, editor }: { block: any; editor: any }) {
  // An empty step is almost always a freshly-inserted one that needs to focus
  // its title immediately, so mount its real editor eagerly. Steps with content
  // start as a cheap read-only preview and upgrade on click/focus.
  const isEmptyStep =
    !((block.props.stepTitle as string) || "") &&
    !((block.props.stepData as string) || "") &&
    !((block.props.expectedResult as string) || "");
  const viewMode = useStepViewMode();
  const [editing, setEditing] = useState(isEmptyStep);
  // Set when editing begins from a click/focus on the preview, so the freshly
  // mounted editor takes focus (a single click starts editing). Cleared after
  // the editor consumes it.
  const focusOnMountRef = useRef(false);
  const [stepNumber, setStepNumber] = useState(() =>
    computeStepNumber(editor.document, block.id),
  );

  useEditorChange(() => {
    // Recompute on change, but bail out of the state update (and therefore the
    // re-render) when the number is unchanged. This is the key win: ordinary
    // text edits leave every step's number untouched, so they don't re-render
    // the whole step list.
    const next = computeStepNumber(editor.document, block.id);
    setStepNumber((prev) => (prev === next ? prev : next));
  }, editor);

  const beginEditing = useCallback(() => {
    focusOnMountRef.current = true;
    setEditing(true);
  }, []);

  const endEditing = useCallback(() => setEditing(false), []);

  if (editing) {
    // Empty steps mounted eagerly (freshly inserted) auto-focus their title.
    // A preview upgraded by a click focuses its field too, so a single click
    // starts editing. The editor tears back down to a preview when focus
    // leaves the step (see TestStepContent's blur handling).
    return (
      <TestStepContent
        block={block}
        editor={editor}
        stepNumber={stepNumber}
        viewMode={viewMode}
        autoFocusEnabled={isEmptyStep}
        focusOnMount={focusOnMountRef.current}
        onEditEnd={endEditing}
      />
    );
  }

  return (
    <div
      className="bn-teststep-preview-wrapper"
      tabIndex={0}
      onMouseDownCapture={beginEditing}
      onFocusCapture={beginEditing}
    >
      <TestStepPreview
        blockId={block.id}
        stepNumber={stepNumber}
        viewMode={viewMode}
        stepTitle={(block.props.stepTitle as string) || ""}
        stepData={(block.props.stepData as string) || ""}
        expectedResult={(block.props.expectedResult as string) || ""}
      />
    </div>
  );
}

function TestStepContent({
  block,
  editor,
  stepNumber,
  viewMode,
  autoFocusEnabled = false,
  focusOnMount = false,
  onEditEnd,
}: {
  block: any;
  editor: any;
  stepNumber: number;
  viewMode: StepViewMode;
  autoFocusEnabled?: boolean;
  focusOnMount?: boolean;
  onEditEnd?: () => void;
}) {
      // When a preview is upgraded by a click, focus its primary field once on
      // mount so a single click starts editing (caret at end).
      const mountFocusSignal = focusOnMount ? 1 : 0;
      const stepTitle = (block.props.stepTitle as string) || "";
      const stepData = (block.props.stepData as string) || "";
      const expectedResult = (block.props.expectedResult as string) || "";
      const expectedHasContent = expectedResult.trim().length > 0;
      /* storedExpectedCollapsed removed — currently unused */
      const dataHasContent = stepData.trim().length > 0;
      const [isExpectedVisible, setIsExpectedVisible] = useState(
        expectedHasContent,
      );
      const [isDataVisible, setIsDataVisible] = useState(dataHasContent);
      const [shouldFocusDataField, setShouldFocusDataField] = useState(false);
      const uploadImage = useStepImageUpload();
      const containerRef = useRef<HTMLDivElement>(null);
      const [forceVertical, setForceVertical] = useState(false);

      useEffect(() => {
        const el = containerRef.current?.parentElement;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            setForceVertical(entry.contentRect.width < FORCE_VERTICAL_WIDTH);
          }
        });
        observer.observe(el);
        return () => observer.disconnect();
      }, []);

      const compactMode = viewMode === "compact";
      const effectiveHorizontal = viewMode === "horizontal" && !forceVertical;
      // A mounted step is, by definition, the one being edited, so it always
      // shows the full editing layout — the collapsed reading row is now the
      // read-only preview's job.
      const compactCollapsed = false;

      // Tear the editor back down to the read-only preview once focus leaves the
      // whole step. Re-checked on the next frame so transient blurs (clicking a
      // toolbar button, or the link popover that portals to <body>) don't
      // collapse an active edit. Edits persist to block props on change, so
      // unmounting never loses data. Re-bound when the layout (and thus the root
      // element) changes so it always listens on the live root.
      useEffect(() => {
        const root = containerRef.current;
        if (!root || !onEditEnd) {
          return;
        }
        const handleFocusOut = () => {
          requestAnimationFrame(() => {
            const active = document.activeElement;
            if (
              active &&
              (root.contains(active) ||
                active.closest(".bn-popover-content, .bn-form-popover, [role='dialog']"))
            ) {
              return;
            }
            onEditEnd();
          });
        };
        root.addEventListener("focusout", handleFocusOut);
        return () => root.removeEventListener("focusout", handleFocusOut);
      }, [onEditEnd, effectiveHorizontal]);

      const combinedStepValue = useMemo(() => {
        if (!stepData) {
          return stepTitle;
        }
        return stepTitle ? `${stepTitle}\n${stepData}` : stepData;
      }, [stepData, stepTitle]);

      const handleCombinedStepChange = useCallback(
        (next: string) => {
          if (next === combinedStepValue) {
            return;
          }
          const [nextTitle = "", ...rest] = next.split("\n");
          const nextData = rest.join("\n");
          editor.updateBlock(block.id, {
            props: {
              stepTitle: nextTitle,
              stepData: nextData,
            },
          });
        },
        [block.id, combinedStepValue, editor],
      );

      const handleStepTitleChange = useCallback(
        (next: string) => {
          if (next === stepTitle) {
            return;
          }

          editor.updateBlock(block.id, {
            props: {
              stepTitle: next,
            },
          });
        },
        [editor, block.id, stepTitle],
      );

      const handleStepDataChange = useCallback(
        (next: string) => {
          if (next === stepData) {
            return;
          }

          editor.updateBlock(block.id, {
            props: {
              stepData: next,
            },
          });
        },
        [editor, block.id, stepData],
      );

      const handleShowData = useCallback(() => {
        setIsDataVisible(true);
        setShouldFocusDataField(true);
      }, []);

      const handleHideData = useCallback(() => {
        setIsDataVisible(false);
        editor.updateBlock(block.id, { props: { stepData: "" } });
      }, [editor, block.id]);

      const handleExpectedChange = useCallback(
        (next: string) => {
          if (next === expectedResult) {
            return;
          }

          editor.updateBlock(block.id, {
            props: {
              expectedResult: next,
            },
          });
        },
        [editor, block.id, expectedResult],
      );

      const handleInsertNextStep = useCallback(() => {
        const allBlocks = editor.document;
        const idx = allBlocks.findIndex((b: any) => b.id === block.id);
        const next = idx >= 0 ? allBlocks[idx + 1] : null;
        if (next && isEmptyParagraph(next)) {
          editor.removeBlocks([next.id]);
        }
        const currentListStyle = (block.props as any).listStyle ?? "bullet";
        editor.insertBlocks(
          [
            {
              type: "testStep",
              props: {
                stepTitle: "",
                stepData: "",
                expectedResult: "",
                listStyle: currentListStyle,
              },
              children: [],
            },
          ],
          block.id,
          "after",
        );
      }, [editor, block.id, block.props]);

      const handleFieldFocus = useCallback(() => {
        const selection = editor.getSelection();
        const blocks = selection?.blocks ?? [];
        const firstId = blocks[0]?.id;
        const lastId = blocks[blocks.length - 1]?.id;
        if (firstId === block.id && lastId === block.id) {
          return;
        }
        try {
          editor.setSelection(block.id, block.id);
        } catch {
          //
        }
      }, [editor, block.id]);

      const handleToggleView = useCallback(() => {
        // Cycle vertical → horizontal → compact → vertical. Skip horizontal when
        // the container is too narrow to fit its two columns.
        let next: StepViewMode;
        if (viewMode === "vertical") {
          next = forceVertical ? "compact" : "horizontal";
        } else if (viewMode === "horizontal") {
          next = "compact";
        } else {
          next = "vertical";
        }
        writeStepViewMode(next);
        // The shared useStepViewMode hook (in every step, including this one)
        // listens for this event and re-reads the mode, so we don't track it
        // locally here.
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("bn-step-view-mode"));
        }
      }, [viewMode, forceVertical]);

      const [dataFocusSignal] = useState(0);
      const [expectedFocusSignal, setExpectedFocusSignal] = useState(0);

      const handleShowExpected = useCallback(() => {
        setIsExpectedVisible(true);
        setExpectedFocusSignal((value) => value + 1);
        writeExpectedCollapsedPreference(false);
      }, []);

      const handleHideExpected = useCallback(() => {
        setIsExpectedVisible(false);
        writeExpectedCollapsedPreference(true);
        editor.updateBlock(block.id, { props: { expectedResult: "" } });
      }, [editor, block.id]);

      const nextViewLabel =
        viewMode === "compact"
          ? "Switch to vertical view"
          : viewMode === "horizontal"
            ? "Switch to compact view"
            : forceVertical
              ? "Switch to compact view"
              : "Switch to horizontal view";

      const viewToggleButton = (
        <button
          type="button"
          className={`bn-teststep__view-toggle${effectiveHorizontal ? " bn-teststep__view-toggle--horizontal" : ""}${compactMode ? " bn-teststep__view-toggle--compact" : ""}`}
          data-tooltip={nextViewLabel}
          aria-label={nextViewLabel}
          onClick={handleToggleView}
          tabIndex={-1}
        >
          {compactMode ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 3.333h12V4.667H2V3.333Zm0 4h12v1.334H2V7.333Zm0 4h12v1.334H2v-1.334Z" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <mask id="mask-toggle" style={{maskType: "alpha"}} maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
                <rect width="16" height="16" fill="#D9D9D9"/>
              </mask>
              <g mask="url(#mask-toggle)">
                <path d="M12.6667 2C13.0333 2 13.3472 2.13056 13.6083 2.39167C13.8694 2.65278 14 2.96667 14 3.33333L14 12.6667C14 13.0333 13.8694 13.3472 13.6083 13.6083C13.3472 13.8694 13.0333 14 12.6667 14L10 14C9.63333 14 9.31944 13.8694 9.05833 13.6083C8.79722 13.3472 8.66667 13.0333 8.66667 12.6667L8.66667 3.33333C8.66667 2.96667 8.79722 2.65278 9.05833 2.39167C9.31945 2.13055 9.63333 2 10 2L12.6667 2ZM6 2C6.36667 2 6.68056 2.13055 6.94167 2.39167C7.20278 2.65278 7.33333 2.96667 7.33333 3.33333L7.33333 12.6667C7.33333 13.0333 7.20278 13.3472 6.94167 13.6083C6.68055 13.8694 6.36667 14 6 14L3.33333 14C2.96667 14 2.65278 13.8694 2.39167 13.6083C2.13056 13.3472 2 13.0333 2 12.6667L2 3.33333C2 2.96667 2.13056 2.65278 2.39167 2.39167C2.65278 2.13055 2.96667 2 3.33333 2L6 2ZM3.33333 12.6667L6 12.6667L6 3.33333L3.33333 3.33333L3.33333 12.6667Z" fill="currentColor"/>
              </g>
            </svg>
          )}
        </button>
      );

      if (effectiveHorizontal) {
        return (
          <StepHorizontalView
            ref={containerRef}
            blockId={block.id}
            stepNumber={stepNumber}
            stepValue={combinedStepValue}
            expectedResult={expectedResult}
            onStepChange={handleCombinedStepChange}
            onExpectedChange={handleExpectedChange}
            onInsertNextStep={handleInsertNextStep}
            onFieldFocus={handleFieldFocus}
            viewToggle={viewToggleButton}
            focusSignal={mountFocusSignal}
          />
        );
      }

      return (
        <div
          className={`bn-teststep${compactMode ? " bn-teststep--compact" : ""}${compactCollapsed ? " bn-teststep--collapsed" : ""}`}
          data-block-id={block.id}
          ref={containerRef}
        >
          <div className="bn-teststep__timeline">
            <span className="bn-teststep__number">{stepNumber}</span>
            <div className="bn-teststep__line" />
          </div>
          <div className="bn-teststep__content">
            <div className="bn-teststep__header">
              {!compactMode && <span className="bn-teststep__title">Step</span>}
              {viewToggleButton}
            </div>
            <StepField
              label="Step"
              showLabel={false}
              value={stepTitle}
              placeholder={STEP_TITLE_PLACEHOLDER}
              onChange={handleStepTitleChange}
              autoFocus={autoFocusEnabled && stepTitle.length === 0}
              focusSignal={mountFocusSignal}
              multiline
              disableNewlines
              enableAutocomplete
              fieldName="title"
              compact={compactCollapsed}
              compactMode={compactMode}
              suggestionFilter={(suggestion) => (suggestion as StepSuggestion).isSnippet !== true}
              onFieldFocus={handleFieldFocus}
              enableImageUpload={false}
              showFormattingButtons
              onImageFile={async (file) => {
                if (!uploadImage) {
                  return;
                }

                setIsDataVisible(true);
                setShouldFocusDataField(true);
                try {
                  const result = await uploadImage(file);
                  if (result?.url) {
                    const nextValue = stepData.trim().length > 0 ? `${stepData}\n![](${result.url})` : `![](${result.url})`;
                    editor.updateBlock(block.id, {
                      props: {
                        stepData: nextValue,
                      },
                    });
                  }
                } catch (error) {
                  console.error("Failed to upload image to Step Data", error);
                }
              }}
            />
            {isDataVisible ? (
              <StepField
                label="Step data"
                showLabel={!compactCollapsed}
                compact={compactCollapsed}
                compactMode={compactMode}
                placeholder={STEP_DATA_PLACEHOLDER}
                labelAction={
                  <button
                    type="button"
                    className="bn-step-field__dismiss"
                    data-tooltip="Hide step data"
                    onClick={handleHideData}
                    aria-label="Hide step data"
                  >
                    ×
                  </button>
                }
                value={stepData}
                onChange={handleStepDataChange}
                autoFocus={shouldFocusDataField}
                focusSignal={dataFocusSignal}
                multiline
                enableAutocomplete
                enableImageUpload
                showFormattingButtons
                showImageButton
                onFieldFocus={handleFieldFocus}
              />
            ) : null}
            {isExpectedVisible ? (
              <StepField
                label="Expected result"
                showLabel={!compactCollapsed}
                compact={compactCollapsed}
                compactMode={compactMode}
                fieldName="expected"
                placeholder={EXPECTED_RESULT_PLACEHOLDER}
                labelAction={
                  <button
                    type="button"
                    className="bn-step-field__dismiss"
                    data-tooltip="Hide expected result"
                    onClick={handleHideExpected}
                    tabIndex={-1}
                    aria-label="Hide expected result"
                  >
                    ×
                  </button>
                }
                value={expectedResult}
                onChange={handleExpectedChange}
                multiline
                focusSignal={expectedFocusSignal}
                enableAutocomplete
                enableImageUpload
                showFormattingButtons
                showImageButton
                onFieldFocus={handleFieldFocus}
              />
            ) : null}
            <div className="bn-step-actions">
              <button type="button" className="bn-step-action-btn" onClick={handleInsertNextStep}>
                <svg className="bn-step-action-btn__icon" width="16" height="16" viewBox="0 0 13.334 13.334" fill="none" aria-hidden="true">
                  <path d="M6.667 0a6.667 6.667 0 1 1 0 13.334A6.667 6.667 0 0 1 6.667 0Zm0 1.334a5.333 5.333 0 1 0 0 10.666 5.333 5.333 0 0 0 0-10.666ZM7.334 3.334V6H10v1.334H7.334V10H6V7.334H3.334V6H6V3.334h1.334Z" fill="currentColor"/>
                </svg>
                Add new step
              </button>
              {!isDataVisible && (
                <button type="button" className="bn-step-action-btn" onClick={handleShowData}>
                  <svg className="bn-step-action-btn__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.666 7.333H12.666V8.667H8.666V12.667H7.332V8.667H3.332V7.333H7.332V3.333H8.666V7.333Z" fill="currentColor"/>
                  </svg>
                  Step data
                </button>
              )}
              {!isExpectedVisible && (
                <button type="button" className="bn-step-action-btn" onClick={handleShowExpected}>
                  <svg className="bn-step-action-btn__icon" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.666 7.333H12.666V8.667H8.666V12.667H7.332V8.667H3.332V7.333H7.332V3.333H8.666V7.333Z" fill="currentColor"/>
                  </svg>
                  Expected result
                </button>
              )}
            </div>
          </div>
        </div>
      );
}

export const stepBlock = createReactBlockSpec(
  {
    type: "testStep",
    content: "none",
    propSchema: {
      stepTitle: {
        default: "",
      },
      stepData: {
        default: "",
      },
      expectedResult: {
        default: "",
      },
      listStyle: {
        default: "bullet",
      },
    },
  },
  {
    render: ({ block, editor }) => (
      <TestStepBlock block={block} editor={editor} />
    ),
  },
);

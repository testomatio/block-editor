import { createReactBlockSpec, useEditorChange } from "@blocknote/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StepField } from "./stepField";
import { StepHorizontalView } from "./stepHorizontalView";
import { useStepImageUpload } from "../stepImageUpload";
import type { StepSuggestion } from "../stepAutocomplete";

const EXPECTED_COLLAPSED_KEY = "bn-expected-collapsed";
const VIEW_MODE_KEY = "bn-step-view-mode";
const STEP_TITLE_PLACEHOLDER = "Enter step title...";
const STEP_DATA_PLACEHOLDER = "Enter step data...";
const EXPECTED_RESULT_PLACEHOLDER = "Enter expected result...";
type StepViewMode = "vertical" | "horizontal";

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
    return window.localStorage.getItem(VIEW_MODE_KEY) === "horizontal" ? "horizontal" : "vertical";
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
    render: ({ block, editor }) => {
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
      const [documentVersion, setDocumentVersion] = useState(0);
      const uploadImage = useStepImageUpload();
      const [viewMode, setViewMode] = useState<StepViewMode>(() => readStepViewMode());

      // Calculate step number based on position in document
      const stepNumber = useMemo(() => {
        const allBlocks = editor.document;
        const blockIndex = allBlocks.findIndex((b) => b.id === block.id);
        if (blockIndex < 0) return 1;

        let count = 1;
        for (let i = blockIndex - 1; i >= 0; i--) {
          if (allBlocks[i].type === "testStep") {
            count++;
          } else {
            break;
          }
        }
        return count;
      }, [block.id, documentVersion, editor.document]);

      // Check if there is a preceding "Steps" heading
      const hasStepsHeading = useMemo(() => {
        const allBlocks = editor.document;
        const blockIndex = allBlocks.findIndex((b) => b.id === block.id);
        if (blockIndex < 0) return false;

        for (let i = blockIndex - 1; i >= 0; i--) {
          const b = allBlocks[i];
          if (b.type === "testStep" || b.type === "snippet") {
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
            return text === "steps";
          }
          return false;
        }
        return false;
      }, [block.id, documentVersion, editor.document]);

      useEditorChange(() => {
        setDocumentVersion((version) => version + 1);
      }, editor);

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

      useEffect(() => {
        if (dataHasContent && !isDataVisible) {
          setIsDataVisible(true);
        }
      }, [dataHasContent, isDataVisible]);

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
      }, []);

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
        editor.insertBlocks(
          [
            {
              type: "testStep",
              props: {
                stepTitle: "",
                stepData: "",
                expectedResult: "",
              },
              children: [],
            },
          ],
          block.id,
          "after",
        );
      }, [editor, block.id]);

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
        const next = viewMode === "horizontal" ? "vertical" : "horizontal";
        writeStepViewMode(next);
        setViewMode(next);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("bn-step-view-mode"));
        }
      }, [viewMode]);

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
      }, []);

      useEffect(() => {
        if (expectedHasContent && !isExpectedVisible) {
          setIsExpectedVisible(true);
        }
      }, [expectedHasContent, isExpectedVisible]);

      const canToggleData = !dataHasContent;
      const canToggleExpected = !expectedHasContent;

      // Render as plain text when not under a "Steps" heading
      if (!hasStepsHeading) {
        return (
          <div className="bn-teststep-plain" data-block-id={block.id}>
            <span>{stepTitle || "(empty step)"}</span>
            {stepData ? <span className="bn-teststep-plain__data">{stepData}</span> : null}
            {expectedResult ? <span className="bn-teststep-plain__expected">{expectedResult}</span> : null}
          </div>
        );
      }

      if (viewMode === "horizontal") {
        return (
          <StepHorizontalView
            blockId={block.id}
            stepNumber={stepNumber}
            stepValue={combinedStepValue}
            expectedResult={expectedResult}
            onStepChange={handleCombinedStepChange}
            onExpectedChange={handleExpectedChange}
            onInsertNextStep={handleInsertNextStep}
            onFieldFocus={handleFieldFocus}
            viewToggle={
              <button
                type="button"
                className="bn-teststep__view-toggle bn-teststep__view-toggle--horizontal"
                data-tooltip="Switch step view"
                aria-label="Switch step view"
                onClick={handleToggleView}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <mask id="mask-toggle" style={{maskType: "alpha"}} maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
                    <rect width="16" height="16" fill="#D9D9D9"/>
                  </mask>
                  <g mask="url(#mask-toggle)">
                    <path d="M12.6667 2C13.0333 2 13.3472 2.13056 13.6083 2.39167C13.8694 2.65278 14 2.96667 14 3.33333L14 12.6667C14 13.0333 13.8694 13.3472 13.6083 13.6083C13.3472 13.8694 13.0333 14 12.6667 14L10 14C9.63333 14 9.31944 13.8694 9.05833 13.6083C8.79722 13.3472 8.66667 13.0333 8.66667 12.6667L8.66667 3.33333C8.66667 2.96667 8.79722 2.65278 9.05833 2.39167C9.31945 2.13055 9.63333 2 10 2L12.6667 2ZM6 2C6.36667 2 6.68056 2.13055 6.94167 2.39167C7.20278 2.65278 7.33333 2.96667 7.33333 3.33333L7.33333 12.6667C7.33333 13.0333 7.20278 13.3472 6.94167 13.6083C6.68055 13.8694 6.36667 14 6 14L3.33333 14C2.96667 14 2.65278 13.8694 2.39167 13.6083C2.13056 13.3472 2 13.0333 2 12.6667L2 3.33333C2 2.96667 2.13056 2.65278 2.39167 2.39167C2.65278 2.13055 2.96667 2 3.33333 2L6 2ZM3.33333 12.6667L6 12.6667L6 3.33333L3.33333 3.33333L3.33333 12.6667Z" fill="currentColor"/>
                  </g>
                </svg>
              </button>
            }
          />
        );
      }

      return (
        <div className="bn-teststep" data-block-id={block.id}>
          <div className="bn-teststep__timeline">
            <span className="bn-teststep__number">{stepNumber}</span>
            <div className="bn-teststep__line" />
          </div>
          <div className="bn-teststep__content">
            <div className="bn-teststep__header">
              <span className="bn-teststep__title">Step</span>
              <button
                type="button"
                className="bn-teststep__view-toggle"
                data-tooltip="Switch step view"
                aria-label="Switch step view"
                onClick={handleToggleView}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <mask id="mask-toggle" style={{maskType: "alpha"}} maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
                    <rect width="16" height="16" fill="#D9D9D9"/>
                  </mask>
                  <g mask="url(#mask-toggle)">
                    <path d="M12.6667 2C13.0333 2 13.3472 2.13056 13.6083 2.39167C13.8694 2.65278 14 2.96667 14 3.33333L14 12.6667C14 13.0333 13.8694 13.3472 13.6083 13.6083C13.3472 13.8694 13.0333 14 12.6667 14L10 14C9.63333 14 9.31944 13.8694 9.05833 13.6083C8.79722 13.3472 8.66667 13.0333 8.66667 12.6667L8.66667 3.33333C8.66667 2.96667 8.79722 2.65278 9.05833 2.39167C9.31945 2.13055 9.63333 2 10 2L12.6667 2ZM6 2C6.36667 2 6.68056 2.13055 6.94167 2.39167C7.20278 2.65278 7.33333 2.96667 7.33333 3.33333L7.33333 12.6667C7.33333 13.0333 7.20278 13.3472 6.94167 13.6083C6.68055 13.8694 6.36667 14 6 14L3.33333 14C2.96667 14 2.65278 13.8694 2.39167 13.6083C2.13056 13.3472 2 13.0333 2 12.6667L2 3.33333C2 2.96667 2.13056 2.65278 2.39167 2.39167C2.65278 2.13055 2.96667 2 3.33333 2L6 2ZM3.33333 12.6667L6 12.6667L6 3.33333L3.33333 3.33333L3.33333 12.6667Z" fill="currentColor"/>
                  </g>
                </svg>
              </button>
            </div>
            <StepField
              label="Step"
              showLabel={false}
              value={stepTitle}
              placeholder={STEP_TITLE_PLACEHOLDER}
              onChange={handleStepTitleChange}
              autoFocus={stepTitle.length === 0}
              enableAutocomplete
              fieldName="title"
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
                placeholder={STEP_DATA_PLACEHOLDER}
                labelAction={
                  canToggleData ? (
                    <button
                      type="button"
                      className="bn-step-field__dismiss"
                      data-tooltip="Hide step data"
                      onClick={handleHideData}
                      aria-label="Hide step data"
                    >
                      ×
                    </button>
                  ) : undefined
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
                placeholder={EXPECTED_RESULT_PLACEHOLDER}
                labelAction={
                  canToggleExpected ? (
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
                  ) : undefined
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
    },
  },
);

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

const readExpectedCollapsedPreference = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(EXPECTED_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
};

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
    },
  },
  {
    render: ({ block, editor }) => {
      const stepTitle = (block.props.stepTitle as string) || "";
      const stepData = (block.props.stepData as string) || "";
      const expectedResult = (block.props.expectedResult as string) || "";
      const expectedHasContent = expectedResult.trim().length > 0;
      const storedExpectedCollapsed = useMemo(
        () => readExpectedCollapsedPreference(),
        [],
      );
      const dataHasContent = stepData.trim().length > 0;
      const [isExpectedVisible, setIsExpectedVisible] = useState(
        expectedHasContent ? true : !storedExpectedCollapsed,
      );
      const [isDataVisible, setIsDataVisible] = useState(dataHasContent);
      const [shouldFocusDataField, setShouldFocusDataField] = useState(false);
      const [documentVersion, setDocumentVersion] = useState(0);
      const uploadImage = useStepImageUpload();
      const [viewMode, setViewMode] = useState<StepViewMode>(() => readStepViewMode());

      // Calculate step number based on position in document
      const stepNumber = useMemo(() => {
        const allBlocks = editor.document;
        const stepBlocks = allBlocks.filter((b) => b.type === "testStep");
        const index = stepBlocks.findIndex((b) => b.id === block.id);
        return index >= 0 ? index + 1 : 1;
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
                aria-label="Switch step view"
                onClick={handleToggleView}
              >
                <span className="bn-teststep__view-icon" aria-hidden="true">
                  <span />
                  <span />
                </span>
              </button>
            }
          />
        );
      }

      return (
        <div className="bn-teststep" data-block-id={block.id}>
          <div className="bn-teststep__header">
            <div className="bn-teststep__meta">
              <span className="bn-teststep__number">{stepNumber}</span>
              <span className="bn-teststep__title">Step</span>
            </div>
            <button
              type="button"
              className="bn-teststep__view-toggle"
              aria-label="Switch step view"
              onClick={handleToggleView}
            >
              <span className="bn-teststep__view-icon" aria-hidden="true">
                <span />
                <span />
              </span>
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
              enableImageUpload
              showFormattingButtons
              showImageButton
              onFieldFocus={handleFieldFocus}
            />
          ) : null}
          <div className="bn-step-actions">
            <button type="button" className="bn-step-add" onClick={handleInsertNextStep}>
              <span className="bn-step-add__icon" aria-hidden="true">
                +
              </span>
              Add new step
            </button>
            {!isDataVisible && (
              <button type="button" className="bn-step-action-link" onClick={handleShowData}>
                <span className="bn-step-action-link__icon" aria-hidden="true">
                  +
                </span>
                Step data
              </button>
            )}
            {!isExpectedVisible && (
              <button type="button" className="bn-step-action-link" onClick={handleShowExpected}>
                <span className="bn-step-action-link__icon" aria-hidden="true">
                  +
                </span>
                Expected result
              </button>
            )}
          </div>
        </div>
      );
    },
  },
);

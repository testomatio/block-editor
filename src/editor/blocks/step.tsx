import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StepField } from "./stepField";
import { useStepImageUpload } from "../stepImageUpload";
import type { StepSuggestion } from "../stepAutocomplete";

const EXPECTED_COLLAPSED_KEY = "bn-expected-collapsed";

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
      const [isExpectedVisible, setIsExpectedVisible] = useState(
        expectedHasContent ? true : !storedExpectedCollapsed,
      );
      const showExpectedField = expectedHasContent || isExpectedVisible;
      const [isDataVisible, setIsDataVisible] = useState(() => stepData.trim().length > 0);
      const [shouldFocusDataField, setShouldFocusDataField] = useState(false);
      const uploadImage = useStepImageUpload();

      useEffect(() => {
        if (stepData.trim().length > 0 && !isDataVisible) {
          setIsDataVisible(true);
        }
      }, [isDataVisible, stepData]);

      useEffect(() => {
        if (shouldFocusDataField && isDataVisible) {
          const timer = setTimeout(() => setShouldFocusDataField(false), 0);
          return () => clearTimeout(timer);
        }
        return undefined;
      }, [isDataVisible, shouldFocusDataField]);

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

      const handleShowDataField = useCallback(() => {
        setIsDataVisible(true);
        setShouldFocusDataField(true);
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
        editor.setSelection(block.id, block.id);
      }, [editor, block.id]);

      const handleShowExpected = useCallback(() => {
        setIsExpectedVisible(true);
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

      const renderExpectedLabel = showExpectedField ? "- Expected Result" : "+ Expected Result";

      return (
        <div className="bn-teststep" data-block-id={block.id}>
            <StepField
              label="Step Title"
              value={stepTitle}
            onChange={handleStepTitleChange}
            autoFocus={stepTitle.length === 0}
            enableAutocomplete
            fieldName="title"
            suggestionFilter={(suggestion) => (suggestion as StepSuggestion).isSnippet !== true}
            onFieldFocus={handleFieldFocus}
            rightAction={
              !isDataVisible ? (
                <button
                  type="button"
                  className="bn-teststep__toggle"
                  onClick={handleShowDataField}
                  aria-expanded="false"
                  tabIndex={-1}
                >
                  + Step Data
                </button>
              ) : null
            }
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
          {isDataVisible && (
            <StepField
              label="Step Data"
              value={stepData}
              onChange={handleStepDataChange}
              autoFocus={shouldFocusDataField}
              multiline
              enableImageUpload
              showFormattingButtons
              showImageButton
              onFieldFocus={handleFieldFocus}
            />
          )}
          {showExpectedField && (
            <StepField
              labelButton={{
                text: renderExpectedLabel,
                onClick: showExpectedField ? handleHideExpected : handleShowExpected,
                expanded: showExpectedField,
              }}
              value={expectedResult}
              onChange={handleExpectedChange}
              multiline
              enableImageUpload
              showFormattingButtons
              showImageButton
              onFieldFocus={handleFieldFocus}
            />
          )}
          <button type="button" className="bn-step-add" onClick={handleInsertNextStep}>
            + Step
          </button>
        </div>
      );
    },
  },
);

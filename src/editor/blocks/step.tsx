import { createReactBlockSpec } from "@blocknote/react";
import { useCallback, useEffect, useState } from "react";
import { StepField } from "./stepField";
import { useStepImageUpload } from "../stepImageUpload";
import type { StepSuggestion } from "../stepAutocomplete";

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
      const showExpectedField =
        stepTitle.trim().length > 0 || stepData.trim().length > 0 || expectedResult.trim().length > 0;
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

      return (
        <div className="bn-teststep" data-block-id={block.id}>
          <StepField
            label="Step Title"
            value={stepTitle}
            placeholder="Describe the action to perform"
            onChange={handleStepTitleChange}
            autoFocus={stepTitle.length === 0}
            enableAutocomplete
            fieldName="title"
            suggestionFilter={(suggestion) => (suggestion as StepSuggestion).isSnippet !== true}
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
              placeholder="Provide additional data about the step"
              onChange={handleStepDataChange}
              autoFocus={shouldFocusDataField}
              multiline
              enableImageUpload
              showFormattingButtons
              showImageButton
            />
          )}
          {showExpectedField && (
            <StepField
              label="Expected Result"
              value={expectedResult}
              placeholder="What should happen?"
              onChange={handleExpectedChange}
              multiline
              enableImageUpload
              showFormattingButtons
              showImageButton
            />
          )}
        </div>
      );
    },
  },
);

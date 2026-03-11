import type { ReactNode } from "react";
import { StepField } from "./stepField";
import type { StepSuggestion } from "../stepAutocomplete";

const STEP_PLACEHOLDER = "Enter step name";
const EXPECTED_RESULT_PLACEHOLDER = "Enter expected result";

type StepHorizontalViewProps = {
  blockId: string;
  stepNumber: number;
  stepValue: string;
  expectedResult: string;
  onStepChange: (next: string) => void;
  onExpectedChange: (next: string) => void;
  onInsertNextStep: () => void;
  onFieldFocus: () => void;
  viewToggle?: ReactNode;
};

export function StepHorizontalView({
  blockId,
  stepNumber,
  stepValue,
  expectedResult,
  onStepChange,
  onExpectedChange,
  onInsertNextStep,
  onFieldFocus,
  viewToggle,
}: StepHorizontalViewProps) {
  return (
    <div className="bn-teststep bn-teststep--horizontal" data-block-id={blockId}>
      <div className="bn-teststep__timeline">
        <span className="bn-teststep__number">{stepNumber}</span>
        <div className="bn-teststep__line" />
      </div>
      <div className="bn-teststep__content">
        <div className="bn-teststep__header">
          <span className="bn-teststep__title">Step</span>
          {viewToggle}
        </div>
        <div className="bn-teststep__horizontal-fields">
          <div className="bn-teststep__horizontal-col">
            <div className="bn-teststep__header">
              <span className="bn-teststep__title">Step</span>
            </div>
            <StepField
              label="Step"
              showLabel={false}
              value={stepValue}
              onChange={onStepChange}
              placeholder={STEP_PLACEHOLDER}
              enableAutocomplete
              fieldName="title"
              suggestionFilter={(suggestion) => (suggestion as StepSuggestion).isSnippet !== true}
              onFieldFocus={onFieldFocus}
              multiline
              enableImageUpload
              showFormattingButtons
              showImageButton
            />
          </div>
          <div className="bn-teststep__horizontal-col">
            <div className="bn-teststep__header">
              <span className="bn-teststep__title">Expected result</span>
            </div>
            <StepField
              label="Expected result"
              showLabel={false}
              value={expectedResult}
              onChange={onExpectedChange}
              placeholder={EXPECTED_RESULT_PLACEHOLDER}
              multiline
              enableAutocomplete
              enableImageUpload
              showFormattingButtons
              showImageButton
              onFieldFocus={onFieldFocus}
            />
          </div>
        </div>
        <div className="bn-step-actions">
          <button type="button" className="bn-step-action-btn" onClick={onInsertNextStep}>
            <svg className="bn-step-action-btn__icon" width="16" height="16" viewBox="0 0 13.334 13.334" fill="none" aria-hidden="true">
              <path d="M6.667 0a6.667 6.667 0 1 1 0 13.334A6.667 6.667 0 0 1 6.667 0Zm0 1.334a5.333 5.333 0 1 0 0 10.666 5.333 5.333 0 0 0 0-10.666ZM7.334 3.334V6H10v1.334H7.334V10H6V7.334H3.334V6H6V3.334h1.334Z" fill="currentColor"/>
            </svg>
            Add new step
          </button>
        </div>
      </div>
    </div>
  );
}

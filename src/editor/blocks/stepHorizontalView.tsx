import type { ReactNode } from "react";
import { StepField } from "./stepField";
import type { StepSuggestion } from "../stepAutocomplete";

const STEP_PLACEHOLDER = "Enter step title...";
const EXPECTED_RESULT_PLACEHOLDER = "Enter expected result...";

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
      <div className="bn-teststep__header bn-teststep__header--grid">
        <span className="bn-teststep__number">{stepNumber}</span>
        <div className="bn-teststep__header-title">Step</div>
        <div className="bn-teststep__header-title" style={{ marginLeft: 24 }}>Expected result</div>
        <div className="bn-teststep__header-toggle">{viewToggle}</div>
      </div>
      <div className="bn-teststep__grid">
        <div className="bn-teststep__gutter" aria-hidden="true" />
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
        <StepField
          label="Expected result"
          showLabel={false}
          value={expectedResult}
          onChange={onExpectedChange}
          placeholder={EXPECTED_RESULT_PLACEHOLDER}
          multiline
          enableImageUpload
          showFormattingButtons
          showImageButton
          onFieldFocus={onFieldFocus}
        />
      </div>
      <div className="bn-teststep__actions-grid">
        <div className="bn-teststep__gutter" aria-hidden="true" />
        <div className="bn-step-actions">
          <button type="button" className="bn-step-add" onClick={onInsertNextStep}>
            <span className="bn-step-add__icon" aria-hidden="true">
              +
            </span>
            Add new step
          </button>
        </div>
      </div>
    </div>
  );
}

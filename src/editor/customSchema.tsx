import { defaultBlockSpecs, defaultProps } from "@blocknote/core";
import { BlockNoteSchema } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import type { ChangeEvent, CSSProperties } from "react";

const statusOptions = ["draft", "ready", "blocked"] as const;

type Status = (typeof statusOptions)[number];

const statusLabels: Record<Status, string> = {
  draft: "Draft",
  ready: "Ready",
  blocked: "Blocked",
};

const statusClassNames: Record<Status, string> = {
  draft: "bn-testcase--draft",
  ready: "bn-testcase--ready",
  blocked: "bn-testcase--blocked",
};

const testStepBlock = createReactBlockSpec(
  {
    type: "testStep",
    content: "none",
    propSchema: {
      stepTitle: {
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
      const expectedResult = (block.props.expectedResult as string) || "";
      const showExpectedInput = stepTitle.trim().length > 0;

      const handleInputChange = (
        event: ChangeEvent<HTMLInputElement>,
        key: "stepTitle" | "expectedResult",
      ) => {
        editor.updateBlock(block.id, {
          props: {
            [key]: event.target.value,
          },
        });
      };

      return (
        <div className="bn-teststep">
          <label className="bn-teststep__field">
            <span className="bn-teststep__label">Step Title</span>
            <input
              className="bn-teststep__input"
              placeholder="Describe the action to perform"
              value={stepTitle}
              autoFocus={stepTitle.length === 0}
              onChange={(event) => handleInputChange(event, "stepTitle")}
            />
          </label>
          {showExpectedInput && (
            <label className="bn-teststep__field">
              <span className="bn-teststep__label">Expected Result</span>
              <input
                className="bn-teststep__input"
                placeholder="What should happen?"
                value={expectedResult}
                onChange={(event) => handleInputChange(event, "expectedResult")}
              />
            </label>
          )}
        </div>
      );
    },
  },
);

const testCaseBlock = createReactBlockSpec(
  {
    type: "testCase",
    content: "inline",
    propSchema: {
      textAlignment: defaultProps.textAlignment,
      textColor: defaultProps.textColor,
      backgroundColor: defaultProps.backgroundColor,
      status: {
        default: "draft" as Status,
        values: Array.from(statusOptions),
      },
      reference: {
        default: "",
      },
    },
  },
  {
    render: ({ block, contentRef, editor }) => {
      const status = block.props.status as Status;

      const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const nextStatus = event.target.value as Status;
        editor.updateBlock(block.id, {
          props: {
            status: nextStatus,
          },
        });
      };

      const handleReferenceChange = (event: ChangeEvent<HTMLInputElement>) => {
        editor.updateBlock(block.id, {
          props: {
            reference: event.target.value,
          },
        });
      };

      const style: CSSProperties = {
        textAlign: block.props.textAlignment,
        color:
          block.props.textColor === "default"
            ? undefined
            : (block.props.textColor as string),
        backgroundColor:
          block.props.backgroundColor === "default"
            ? undefined
            : (block.props.backgroundColor as string),
      };

      return (
        <div
          className={"bn-testcase " + statusClassNames[status]}
          data-reference={block.props.reference || undefined}
          style={style}
        >
          <div className="bn-testcase__header">
            <div className="bn-testcase__meta">
              <span className="bn-testcase__label">Test Case</span>
              <input
                className="bn-testcase__reference"
                placeholder="Reference ID"
                value={block.props.reference}
                onChange={handleReferenceChange}
              />
            </div>
            <label className="bn-testcase__status">
              <span>Status:</span>
              <select value={status} onChange={handleStatusChange}>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="bn-testcase__body" ref={contentRef} />
        </div>
      );
    },
  },
);

export const customSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    testCase: testCaseBlock,
    testStep: testStepBlock,
  },
});

export type CustomSchema = typeof customSchema;
export type CustomBlock = CustomSchema["Block"];
export type CustomEditor = CustomSchema["BlockNoteEditor"];

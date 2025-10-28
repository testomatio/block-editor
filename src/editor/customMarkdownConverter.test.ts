import { describe, expect, it } from "vitest";
import {
  blocksToMarkdown,
  markdownToBlocks,
  type CustomEditorBlock,
  type CustomPartialBlock,
} from "./customMarkdownConverter";

const baseProps = {
  textAlignment: "left" as const,
  textColor: "default" as const,
  backgroundColor: "default" as const,
};

const cellProps = {
  backgroundColor: "default" as const,
  textColor: "default" as const,
  textAlignment: "left" as const,
};

const toPartial = (block: CustomEditorBlock): CustomPartialBlock => ({
  type: block.type,
  props: block.props as any,
  content: block.content as any,
  children: block.children?.map(toPartial),
});

describe("blocksToMarkdown", () => {
  it("converts styled paragraphs", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "p1",
        type: "paragraph",
        props: baseProps,
        content: [
          { type: "text", text: "Hello ", styles: {} },
          { type: "text", text: "world", styles: { bold: true } },
          { type: "text", text: "!", styles: { italic: true } },
        ],
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe("Hello **world***!*");
  });

  it("serializes a numbered list", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "n1",
        type: "numberedListItem",
        props: { ...baseProps, start: 1 },
        content: [{ type: "text", text: "First", styles: {} }],
        children: [],
      },
      {
        id: "n2",
        type: "numberedListItem",
        props: { ...baseProps, start: 2 },
        content: [{ type: "text", text: "Second", styles: {} }],
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe("1. First\n2. Second");
  });

  it("serializes a custom test step block", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "s1",
        type: "testStep",
        props: {
          stepTitle: "Open the Login page.",
          stepsDescription: "",
          expectedResult: "The Login page loads successfully.",
        },
        content: undefined,
        children: [],
      },
      {
        id: "s2",
        type: "testStep",
        props: {
          stepTitle: "Enter a valid username.",
          stepsDescription: "",
          expectedResult: "The username is accepted.",
        },
        content: undefined,
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe(
      [
        "* Open the Login page.",
        "  *Expected Result*: The Login page loads successfully.",
        "* Enter a valid username.",
        "  *Expected Result*: The username is accepted.",
      ].join("\n"),
    );
  });

   it("keeps inline formatting inside step fields", () => {
     const blocks: CustomEditorBlock[] = [
       {
         id: "s3",
         type: "testStep",
         props: {
           stepTitle: "**Click** the _Login_ button",
           stepsDescription: "",
           expectedResult: "**Success** is shown\nSecond line with <u>underline</u>",
         },
         content: undefined,
         children: [],
       },
     ];

     expect(blocksToMarkdown(blocks)).toBe(
       [
         "* **Click** the _Login_ button",
         "  *Expected Result*: **Success** is shown",
         "  Second line with <u>underline</u>",
       ].join("\n"),
     );
   });

   it("serializes test step with description", () => {
     const blocks: CustomEditorBlock[] = [
       {
         id: "s4",
         type: "testStep",
         props: {
           stepTitle: "Navigate to login",
           stepsDescription: "Open browser\nGo to login page",
           expectedResult: "Login form visible",
         },
         content: undefined,
         children: [],
       },
     ];

     expect(blocksToMarkdown(blocks)).toBe(
       [
         "* Navigate to login",
         "  Open browser",
         "  Go to login page",
         "  *Expected Result*: Login form visible",
       ].join("\n"),
     );
   });

  it("exports the custom test case block", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "tc1",
        type: "testCase",
        props: {
          ...baseProps,
          status: "ready",
          reference: "QA-7",
        },
        content: [
          {
            type: "text",
            text: "Run the smoke tests.",
            styles: {},
          },
        ],
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe(
      ":::test-case status=\"ready\" reference=\"QA-7\"\nRun the smoke tests.\n:::",
    );
  });

  it("serializes tables", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "tbl1",
        type: "table",
        props: { textColor: "default" },
        content: {
          type: "tableContent",
          columnWidths: [undefined, undefined],
          headerRows: 1,
          rows: [
            {
              cells: [
                {
                  type: "tableCell",
                  props: cellProps,
                  content: [{ type: "text", text: "Step", styles: {} }],
                },
                {
                  type: "tableCell",
                  props: cellProps,
                  content: [{ type: "text", text: "Expected", styles: {} }],
                },
              ],
            },
            {
              cells: [
                {
                  type: "tableCell",
                  props: cellProps,
                  content: [{ type: "text", text: "Do thing", styles: {} }],
                },
                {
                  type: "tableCell",
                  props: cellProps,
                  content: [{ type: "text", text: "It works", styles: {} }],
                },
              ],
            },
          ],
        },
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe(
      [
        "| Step | Expected |",
        "| --- | --- |",
        "| Do thing | It works |",
      ].join("\n"),
    );
  });
});

describe("markdownToBlocks", () => {
  it("parses test steps and test cases", () => {
    const markdown = [
      "* Open the Login page.",
      "  *Expected Result*: The Login page loads successfully.",
      "",
      ":::test-case status=\"ready\" reference=\"QA-7\"",
      "Run the smoke tests.",
      ":::",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Open the Login page.",
          stepsDescription: "",
          expectedResult: "The Login page loads successfully.",
        },
        children: [],
      },
      {
        type: "testCase",
        props: {
          ...baseProps,
          status: "ready",
          reference: "QA-7",
        },
        content: [{ type: "text", text: "Run the smoke tests.", styles: {} }],
        children: [],
      },
   ]);
  });

  it("parses step lists with inline expected results label", () => {
    const markdown = [
      "## Test Description: Real-time notifications (chat, order updates, file received)",
      "",
      "This test case verifies the functionality of real-time notifications for chat messages, order updates, and file receipts within the application.",
      "",
      "### Preconditions",
      "* The user is logged into the application.",
      "* The user has the necessary permissions to receive notifications.",
      "* The application is configured to send real-time notifications.",
      "",
      "### Steps",
      "",
      "* Step 1: Send a chat message to the user.",
      "**Expected Result**: The user receives a real-time notification for the chat message.",
      "* Step 2: Update an order status.",
      "**Expected Result**: The user receives a real-time notification for the order update.",
      "* Step 3: Send a file to the user.",
      "**Expected Result**: The user receives a real-time notification for the file received.",
      "* Step 4: Verify that the notifications are displayed correctly in the application's notification panel.",
      "**Expected Result**: All notifications (chat message, order update, file received) are listed in the notification panel with the correct information (e.g., timestamp, message content).",
      "",
      "### Postconditions",
      "* The user has received and viewed the notifications.",
      "* The application continues to function as expected after receiving and processing the notifications.",
    ].join("\n");

    const blocks = markdownToBlocks(markdown);
    const stepBlocks = blocks.filter((block) => block.type === "testStep");

    expect(stepBlocks).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Step 1: Send a chat message to the user.",
          stepsDescription: "",
          expectedResult: "The user receives a real-time notification for the chat message.",
        },
        children: [],
      },
      {
        type: "testStep",
        props: {
          stepTitle: "Step 2: Update an order status.",
          stepsDescription: "",
          expectedResult: "The user receives a real-time notification for the order update.",
        },
        children: [],
      },
      {
        type: "testStep",
        props: {
          stepTitle: "Step 3: Send a file to the user.",
          stepsDescription: "",
          expectedResult: "The user receives a real-time notification for the file received.",
        },
        children: [],
      },
      {
        type: "testStep",
        props: {
          stepTitle: "Step 4: Verify that the notifications are displayed correctly in the application's notification panel.",
          stepsDescription: "",
          expectedResult: "All notifications (chat message, order update, file received) are listed in the notification panel with the correct information (e.g., timestamp, message content).",
        },
        children: [],
      },
    ]);
  });

  it("parses bullet lists written with asterisk markers", () => {
    const markdown = [
      "### Preconditions",
      "",
      "* The user is logged into the application.",
      "* The user has the necessary permissions to receive notifications.",
      "* The application is configured to send real-time notifications.",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "heading",
        props: { ...baseProps, level: 3 },
        content: [{ type: "text", text: "Preconditions", styles: {} }],
        children: [],
      },
      {
        type: "bulletListItem",
        props: baseProps,
        content: [
          {
            type: "text",
            text: "The user is logged into the application.",
            styles: {},
          },
        ],
        children: [],
      },
      {
        type: "bulletListItem",
        props: baseProps,
        content: [
          {
            type: "text",
            text: "The user has the necessary permissions to receive notifications.",
            styles: {},
          },
        ],
        children: [],
      },
      {
        type: "bulletListItem",
        props: baseProps,
        content: [
          {
            type: "text",
            text: "The application is configured to send real-time notifications.",
            styles: {},
          },
        ],
        children: [],
      },
    ]);
  });

   it("parses expected result prefixes with emphasis", () => {
     const markdown = [
       "* Open the form.",
       "  **Expected Result:** The form opens.",
       "  Expected: Fields are empty.",
     ].join("\n");

     expect(markdownToBlocks(markdown)).toEqual([
       {
         type: "testStep",
         props: {
           stepTitle: "Open the form.",
           stepsDescription: "",
           expectedResult: "Fields are empty.",
         },
         children: [],
       },
     ]);
   });

   it("parses test step with description", () => {
     const markdown = [
       "* Navigate to login",
       "  Open browser",
       "  Go to login page",
       "  *Expected Result*: Login form visible",
     ].join("\n");

     expect(markdownToBlocks(markdown)).toEqual([
       {
         type: "testStep",
         props: {
           stepTitle: "Navigate to login",
           stepsDescription: "Open browser\nGo to login page",
           expectedResult: "Login form visible",
         },
         children: [],
       },
     ]);
   });

  it("round-trips simple blocks", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "p1",
        type: "paragraph",
        props: baseProps,
        content: [{ type: "text", text: "Paragraph", styles: {} }],
        children: [],
      },
      {
        id: "b1",
        type: "bulletListItem",
        props: baseProps,
        content: [{ type: "text", text: "Bullet", styles: {} }],
        children: [],
      },
    ];

    const markdown = blocksToMarkdown(blocks);
    const parsed = markdownToBlocks(markdown);
    expect(parsed).toEqual(blocks.map(toPartial));
  });

  it("parses markdown tables", () => {
    const markdown = [
      "| Step | Expected |",
      "| :--- | ---: |",
      "| Do thing | It works |",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "table",
        props: { textColor: "default" },
        content: {
          type: "tableContent",
          columnWidths: [undefined, undefined],
          headerRows: 1,
          rows: [
            {
              cells: [
                {
                  type: "tableCell",
                  props: { ...cellProps, textAlignment: "left" },
                  content: [{ type: "text", text: "Step", styles: {} }],
                },
                {
                  type: "tableCell",
                  props: { ...cellProps, textAlignment: "right" },
                  content: [{ type: "text", text: "Expected", styles: {} }],
                },
              ],
            },
            {
              cells: [
                {
                  type: "tableCell",
                  props: { ...cellProps, textAlignment: "left" },
                  content: [{ type: "text", text: "Do thing", styles: {} }],
                },
                {
                  type: "tableCell",
                  props: { ...cellProps, textAlignment: "right" },
                  content: [{ type: "text", text: "It works", styles: {} }],
                },
              ],
            },
          ],
        },
        children: [],
      },
    ]);
  });
});

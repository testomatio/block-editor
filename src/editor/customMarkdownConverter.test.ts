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
          stepData: "",
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
          stepData: "",
          expectedResult: "The username is accepted.",
        },
        content: undefined,
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe(
      [
        "* Open the Login page.",
        "  *Expected*: The Login page loads successfully.",
        "* Enter a valid username.",
        "  *Expected*: The username is accepted.",
      ].join("\n"),
    );
  });

  it("serializes a snippet block with prefixed title", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "sn1",
        type: "snippet",
        props: {
          snippetId: "501",
          snippetTitle: "Open the login page",
          snippetData: "Navigate to /login",
          snippetExpectedResult: "Login form renders",
        },
        content: undefined,
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe(
      [
        "<!-- begin snippet #501 -->",
        "Navigate to /login",
        "<!-- end snippet #501 -->",
      ].join("\n"),
    );
  });

  it("serializes snippet bodies without duplicating wrapper comments", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "sn2",
        type: "snippet",
        props: {
          snippetId: "777",
          snippetTitle: "Has inline wrappers",
          snippetData: [
            "<!-- begin snippet #777 -->",
            "Line 1",
            "Line 2",
            "<!-- end snippet #777 -->",
          ].join("\n"),
          snippetExpectedResult: "",
        },
        content: undefined,
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe(
      [
        "<!-- begin snippet #777 -->",
        "Line 1",
        "Line 2",
        "<!-- end snippet #777 -->",
      ].join("\n"),
    );
  });

  it("cleans escaped formatting markers when toggling styles repeatedly", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "esc1",
        type: "paragraph",
        props: baseProps,
        content: [{ type: "text", text: "text", styles: { bold: true, italic: true } }],
        children: [],
      },
    ];

    const markdown = blocksToMarkdown(blocks);
    expect(markdown).toBe("***text***");
  });

   it("keeps inline formatting inside step fields", () => {
     const blocks: CustomEditorBlock[] = [
       {
         id: "s3",
         type: "testStep",
         props: {
           stepTitle: "**Click** the _Login_ button",
           stepData: "",
           expectedResult: "**Success** is shown\nSecond line with <u>underline</u>",
         },
         content: undefined,
         children: [],
       },
     ];

     expect(blocksToMarkdown(blocks)).toBe(
       [
         "* **Click** the _Login_ button",
        "  *Expected*: **Success** is shown",
         "  Second line with <u>underline</u>",
       ].join("\n"),
     );
   });

   it("serializes test step with data", () => {
     const blocks: CustomEditorBlock[] = [
       {
         id: "s4",
         type: "testStep",
         props: {
           stepTitle: "Navigate to login",
           stepData: "Open browser\nGo to login page",
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
      "  *Expected*: Login form visible",
    ].join("\n"),
  );
 });

  it("serializes step data containing code fences, blank lines, and images", () => {
    const blocks: CustomEditorBlock[] = [
      {
        id: "s5",
        type: "testStep",
        props: {
          stepTitle: "Update an order status.",
          stepData: [
            "```",
            "SQL CREATE bnbmnbm mnbmb mm",
            "mn,nm nm, m,nm,n,nn,m,",
            ",n,n,mnm,n asdsad",
            "asdsadsa",
            "",
            "asdsadsadsadsad",
            "",
            "asdsadas",
            "```",
            "![](/attachments/HMhkVtlDrO.png)",
          ].join("\n"),
          expectedResult: "The user receives a real-time notification for the order update.",
        },
        content: undefined,
        children: [],
      },
    ];

    expect(blocksToMarkdown(blocks)).toBe(
      [
        "* Update an order status.",
        "  ```",
        "  SQL CREATE bnbmnbm mnbmb mm",
        "  mn,nm nm, m,nm,n,nn,m,",
        "  ,n,n,mnm,n asdsad",
        "  asdsadsa",
        "  ",
        "  asdsadsadsadsad",
        "  ",
        "  asdsadas",
        "  ```",
        "  ![](/attachments/HMhkVtlDrO.png)",
        "  *Expected*: The user receives a real-time notification for the order update.",
      ].join("\n"),
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

  it("parses a test step with inline image in the title, moving the image to step data", () => {
    const markdown = [
      "## Steps",
      "* asdsadsad aaaaa  asd ![](https://placehold.co/600x400?text=Uploaded+1763329962213)",
    ].join("\n");

    const blocks = markdownToBlocks(markdown);
    const step = blocks.find((b) => b.type === "testStep") as any;

    expect(step).toBeTruthy();
    expect(step.props.stepTitle).toBe("asdsadsad aaaaa asd !");
    expect(step.props.stepData).toBe("![](https://placehold.co/600x400?text=Uploaded+1763329962213)");
    expect(step.props.expectedResult).toBe("");
  });
});

describe("markdownToBlocks", () => {
  it("parses test steps and test cases", () => {
    const markdown = [
      "* Open the Login page.",
      "  *Expected*: The Login page loads successfully.",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Open the Login page.",
          stepData: "",
          expectedResult: "The Login page loads successfully.",
        },
        children: [],
      },
    ]);
  });

  it("parses snippet markdown into snippet blocks", () => {
    const markdown = [
      "<!-- begin snippet #501 -->",
      "Run the seeder",
      "<!-- end snippet #501 -->",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "snippet",
        props: {
          snippetId: "501",
          snippetTitle: "",
          snippetData: "Run the seeder",
          snippetExpectedResult: "",
        },
        children: [],
      },
    ]);
  });

  it("parses snippet bodies and ignores nested snippet markers", () => {
    const markdown = [
      "<!-- begin snippet #888 -->",
      "Prep DB",
      "<!-- begin snippet #ignored -->",
      "Do not keep this marker",
      "<!-- end snippet #ignored -->",
      "<!-- end snippet #888 -->",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "snippet",
        props: {
          snippetId: "888",
          snippetTitle: "",
          snippetData: "Prep DB\nDo not keep this marker",
          snippetExpectedResult: "",
        },
        children: [],
      },
    ]);

    const roundTrip = blocksToMarkdown([
      {
        id: "sn888",
        type: "snippet",
        props: {
          snippetId: "888",
          snippetTitle: "",
          snippetData: "Prep DB\nDo not keep this marker",
          snippetExpectedResult: "",
        },
        content: undefined,
        children: [],
      },
    ]);

    expect(roundTrip).toBe(
      [
        "<!-- begin snippet #888 -->",
        "Prep DB",
        "Do not keep this marker",
        "<!-- end snippet #888 -->",
      ].join("\n"),
    );
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
      "**Expected**: The user receives a real-time notification for the chat message.",
      "* Step 2: Update an order status.",
      "**Expected**: The user receives a real-time notification for the order update.",
      "* Step 3: Send a file to the user.",
      "**Expected**: The user receives a real-time notification for the file received.",
      "* Step 4: Verify that the notifications are displayed correctly in the application's notification panel.",
      "**Expected**: All notifications (chat message, order update, file received) are listed in the notification panel with the correct information (e.g., timestamp, message content).",
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
          stepData: "",
          expectedResult: "The user receives a real-time notification for the chat message.",
        },
        children: [],
      },
      {
        type: "testStep",
        props: {
          stepTitle: "Step 2: Update an order status.",
          stepData: "",
          expectedResult: "The user receives a real-time notification for the order update.",
        },
        children: [],
      },
      {
        type: "testStep",
        props: {
          stepTitle: "Step 3: Send a file to the user.",
          stepData: "",
          expectedResult: "The user receives a real-time notification for the file received.",
        },
        children: [],
      },
      {
        type: "testStep",
        props: {
          stepTitle: "Step 4: Verify that the notifications are displayed correctly in the application's notification panel.",
          stepData: "",
          expectedResult: "All notifications (chat message, order update, file received) are listed in the notification panel with the correct information (e.g., timestamp, message content).\n",
        },
        children: [],
      },
    ]);
  });

  it("parses step data containing code fences, blank lines, and images", () => {
    const markdown = [
      "* Step 2: Update an order status.",
      "  ```",
      "  SQL CREATE bnbmnbm mnbmb mm",
      "  mn,nm nm, m,nm,n,nn,m,",
      "  ,n,n,mnm,n asdsad",
      "  asdsadsa",
      "  ",
      "  asdsadsadsadsad",
      "  ",
      "  asdsadas",
      "  ```",
      "  ![](/attachments/HMhkVtlDrO.png)",
      "**Expected**: The user receives a real-time notification for the order update.",
    ].join("\n");

    const expectedData = [
      "```",
      "SQL CREATE bnbmnbm mnbmb mm",
      "mn,nm nm, m,nm,n,nn,m,",
      ",n,n,mnm,n asdsad",
      "asdsadsa",
      "",
      "asdsadsadsadsad",
      "",
      "asdsadas",
      "```",
      "![](/attachments/HMhkVtlDrO.png)",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Step 2: Update an order status.",
          stepData: expectedData,
          expectedResult: "The user receives a real-time notification for the order update.",
        },
        children: [],
      },
    ]);

    const markdownRoundTrip = blocksToMarkdown([
      {
        id: "step2",
        type: "testStep",
        props: {
          stepTitle: "Step 2: Update an order status.",
          stepData: expectedData,
          expectedResult: "The user receives a real-time notification for the order update.",
        },
        content: undefined,
        children: [],
      },
    ]);

    expect(markdownRoundTrip).toBe(
      [
        "* Step 2: Update an order status.",
        "  ```",
        "  SQL CREATE bnbmnbm mnbmb mm",
        "  mn,nm nm, m,nm,n,nn,m,",
        "  ,n,n,mnm,n asdsad",
        "  asdsadsa",
        "  ",
        "  asdsadsadsadsad",
        "  ",
        "  asdsadas",
        "  ```",
        "  ![](/attachments/HMhkVtlDrO.png)",
        "  *Expected*: The user receives a real-time notification for the order update.",
      ].join("\n"),
    );
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

  it("handles nested lists with uneven indentation", () => {
    const markdown = [
      "### Requirements",
      "",
      "* Verify that each individual unit test completes in ≤ 50 ms (target) and never exceeds 200 ms (hard limit).",
      "",
      "### Steps",
      "",
      "1. Execute the full unit test suite with a timer wrapper.",
      "   * Each individual test case.",
      "   * Each test file.",
      "2. Collect timing data for the security-critical modules.",
    ].join("\n");

    const blocks = markdownToBlocks(markdown);
    const numbered = blocks.filter((block) => block.type === "numberedListItem");

    expect(numbered).not.toHaveLength(0);
    const nestedChildren = numbered.flatMap((block) => block.children ?? []);
    expect(nestedChildren.some((child) => child.type === "bulletListItem")).toBe(true);
  });

   it("parses expected result prefixes with emphasis", () => {
     const markdown = [
       "* Open the form.",
       "  **Expected:** The form opens.",
       "  Expected: Fields are empty.",
     ].join("\n");

     expect(markdownToBlocks(markdown)).toEqual([
       {
         type: "testStep",
         props: {
           stepTitle: "Open the form.",
           stepData: "",
           expectedResult: "** The form opens.\nFields are empty.",
         },
         children: [],
       },
     ]);
   });

   it("parses test step with data", () => {
     const markdown = [
       "* Navigate to login",
       "  Open browser",
       "  Go to login page",
       "  *Expected*: Login form visible",
     ].join("\n");

     expect(markdownToBlocks(markdown)).toEqual([
       {
         type: "testStep",
         props: {
           stepTitle: "Navigate to login",
           stepData: "Open browser\nGo to login page",
           expectedResult: "Login form visible",
         },
         children: [],
       },
   ]);
  });

  it("parses unindented step data between the title and expected result", () => {
    const markdown = [
      "* Prepare test fixtures",
      "Collect user accounts from staging.",
      "Reset passwords for all test accounts.",
      "*Expected*: Test accounts are ready for execution.",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Prepare test fixtures",
          stepData: "Collect user accounts from staging.\nReset passwords for all test accounts.",
          expectedResult: "Test accounts are ready for execution.",
        },
        children: [],
      },
    ]);
  });

  it("parses expected result containing a markdown image", () => {
    const markdown = [
      "* Display the generated report.",
      "  *Expected*: ![](/attachments/report.png)",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Display the generated report.",
          stepData: "",
          expectedResult: "![](/attachments/report.png)",
        },
        children: [],
      },
    ]);

    const markdownRoundTrip = blocksToMarkdown([
      {
        id: "step-image",
        type: "testStep",
        props: {
          stepTitle: "Display the generated report.",
          stepData: "",
          expectedResult: "![](/attachments/report.png)",
        },
        content: undefined,
        children: [],
      },
    ]);

    expect(markdownRoundTrip).toBe(markdown);
  });

  it("parses expected result with short expected label and image", () => {
    const markdown = [
      "* Should open login screen",
      "  *Expected*: Login should look like this",
      "  ![](/login.png)",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Should open login screen",
          stepData: "",
          expectedResult: "Login should look like this\n![](/login.png)",
        },
        children: [],
      },
    ]);

    const roundTrip = blocksToMarkdown([
      {
        id: "step-login",
        type: "testStep",
        props: {
          stepTitle: "Should open login screen",
          stepData: "",
          expectedResult: "Login should look like this\n![](/login.png)",
        },
        content: undefined,
        children: [],
      },
    ]);

    expect(roundTrip).toBe(
      [
        "* Should open login screen",
        "  *Expected*: Login should look like this",
        "  ![](/login.png)",
      ].join("\n"),
    );
  });

  it("parses steps under a Steps heading even when expected results are missing", () => {
    const markdown = [
      "### Steps",
      "",
      "* Pass onboarding as mobile user",
      "* Navigate to More tab -≻ My Profile -≻ Log into the app with user from preconditions",
      "  *Expected:* Upsell SS screen is displayed",
      "* Close SS",
      "  *Expected:* My Course and More tab are displayed",
    ].join("\n");

    const blocks = markdownToBlocks(markdown);
    const stepBlocks = blocks.filter((block) => block.type === "testStep");

    expect(stepBlocks).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Pass onboarding as mobile user",
          stepData: "",
          expectedResult: "",
        },
        children: [],
      },
      {
        type: "testStep",
        props: {
          stepTitle:
            "Navigate to More tab -≻ My Profile -≻ Log into the app with user from preconditions",
          stepData: "",
          expectedResult: "* Upsell SS screen is displayed",
        },
        children: [],
      },
      {
        type: "testStep",
        props: {
          stepTitle: "Close SS",
          stepData: "",
          expectedResult: "* My Course and More tab are displayed",
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

  it("parses expected result lines written with bold 'Expected Result' prefix for compatibility", () => {
    const markdown = [
      "* Step 1: Send a chat message to the user.",
      "**Expected Result**: The user receives a real-time notification for the chat message.",
    ].join("\n");

    expect(markdownToBlocks(markdown)).toEqual([
      {
        type: "testStep",
        props: {
          stepTitle: "Step 1: Send a chat message to the user.",
          stepData: "",
          expectedResult: "The user receives a real-time notification for the chat message.",
        },
        children: [],
      },
    ]);
  });

  it("parses multiple Expected blocks within a single test step", () => {
    const markdown = [
      "### Steps",
      "",
      "* Swipe Back",
      "* Check UI of Sleep score info screen",
      "  - Back button",
      "    Header: Sleep Score Info",
      "    Text: Ever wonder if 6, 8, or 9 hours of sleep are enough? Sleep score takes the guesswork out of your ZZZ's and shows you how well you slept last night based on duration, efficiency, and consistency.",
      "  *Expected:* - 1st block:",
      "  *Expected:* - 2nd block:",
      "  *Expected:* - 3d block:",
      "* Tap 'Back' button",
    ].join("\n");

    const blocks = markdownToBlocks(markdown);
    const stepBlocks = blocks.filter((block) => block.type === "testStep");

    expect(stepBlocks).toHaveLength(3);

    expect(stepBlocks[0]).toEqual({
      type: "testStep",
      props: {
        stepTitle: "Swipe Back",
        stepData: "",
        expectedResult: "",
      },
      children: [],
    });

    expect(stepBlocks[1]).toEqual({
      type: "testStep",
      props: {
        stepTitle: "Check UI of Sleep score info screen",
        stepData: "- Back button\nHeader: Sleep Score Info\nText: Ever wonder if 6, 8, or 9 hours of sleep are enough? Sleep score takes the guesswork out of your ZZZ's and shows you how well you slept last night based on duration, efficiency, and consistency.",
        expectedResult: "* - 1st block:\n* - 2nd block:\n* - 3d block:",
      },
      children: [],
    });

    expect(stepBlocks[2]).toEqual({
      type: "testStep",
      props: {
        stepTitle: "Tap 'Back' button",
        stepData: "",
        expectedResult: "",
      },
      children: [],
    });
  });
});

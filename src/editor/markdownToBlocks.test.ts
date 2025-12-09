import { describe, expect, it } from "vitest";
import {
  markdownToBlocks,
  type CustomEditorBlock,
  type CustomPartialBlock,
} from "./customMarkdownConverter";

const baseProps = {
  textAlignment: "left" as const,
  textColor: "default" as const,
  backgroundColor: "default" as const,
};

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
  });

  // Adding just a few more critical tests to keep the file small and focused
  it("parses step lists with inline expected results label", () => {
    const markdown = [
      "## Test Description: Real-time notifications (chat, order updates, file received)",
      "",
      "This test case verifies the functionality of real-time notifications for chat messages, order updates, and file receipts within the application.",
      "",
      "### Preconditions",
      "",
      "### Steps",
      "",
      "* Step 1: Send a chat message to the user.",
      "**Expected**: The user receives a real-time notification for the chat message.",
      "* Step 2: Update an order status.",
      "**Expected**: The user receives a real-time notification for the order update.",
    ].join("\n");

    const blocks = markdownToBlocks(markdown);
    const stepBlocks = blocks.filter((block) => block.type === "testStep");

    expect(stepBlocks).toHaveLength(2);
    expect(stepBlocks[0]).toEqual({
      type: "testStep",
      props: {
        stepTitle: "Step 1: Send a chat message to the user.",
        stepData: "",
        expectedResult: "The user receives a real-time notification for the chat message.",
      },
      children: [],
    });
  });

  it("round-trips simple blocks", () => {
    const markdown = "Simple paragraph text";
    const blocks = markdownToBlocks(markdown);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      props: baseProps,
      content: [{ type: "text", text: "Simple paragraph text", styles: {} }],
      children: [],
    });
  });
});
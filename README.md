# Testomatio Editor Blocks

Custom BlockNote blocks, schema, and Markdown conversion helpers for Testomatio-style test cases and steps. The repository bundles two things:

- A Vite playground (`npm run dev`) for trying the blocks in isolation.
- A publishable package (`npm run build:package`) that writes the distributable files to `package/`.

## Prerequisites

- Node.js 20+
- npm 9+

Install once after cloning:

```bash
npm install
```

## Running The UI

Start the Vite dev server:

```bash
npm run dev
```

The app defaults to `http://localhost:5173`. Paste Markdown (including tables or step blocks) directly into the editor to see it converted into structured blocks, while the right-hand panels display the Markdown and block JSON previews.

## Building the Package

Create the publishable bundle (JavaScript, type declarations, and stylesheet) by running:

```bash
npm run build:package
```

The compiled files land in `package/`:

- `package/index.js` and `package/index.d.ts` export the schema plus converters.
- `package/editor/...` contains the underlying source hierarchy for easier debugging.
- `package/styles.css` ships all required styles for the blocks.

Running `npm run build` will also invoke Vite and place the playground site in `dist/`, which you can upload to Cloudflare Pages if you want a hosted demo.

## Using Inside Any BlockNote Editor

1. **Install**

   Add `testomatio-editor-blocks` alongside the BlockNote packages you already use:

   ```bash
   npm install testomatio-editor-blocks @blocknote/react @blocknote/core
   ```

   (If you are working locally before publishing, use `npm install ../path/to/testomatio-editor-blocks --save`.)

2. **Load the schema and helpers**

```jsx
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote, useEditorChange } from "@blocknote/react";
import {
  customSchema,
  markdownToBlocks,
  blocksToMarkdown,
  testomatioEditorClassName,
} from "testomatio-editor-blocks";
import "testomatio-editor-blocks/styles.css";

const editor = useCreateBlockNote({
  schema: customSchema,
  pasteHandler: ({ event, editor, defaultPasteHandler }) => {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!text.trim()) {
      return defaultPasteHandler();
    }
    try {
      const blocks = markdownToBlocks(text);
      editor.insertBlocks(blocks);
      return true;
    } catch {
      return defaultPasteHandler();
    }
  },
});

useEditorChange((instance) => {
  const markdown = blocksToMarkdown(instance.document);
  // Persist markdown to your backend or trigger app logic.
  console.log(markdown);
}, editor);

return (
  <BlockNoteView
    editor={editor}
    className={testomatioEditorClassName}
    slashMenu={false}
  />
);
```

3. **Work with Markdown**

- `markdownToBlocks(markdown: string)` converts Testomatio Markdown into BlockNote block definitions ready for insertion.
- `blocksToMarkdown(blocks)` serialises editor content back into Markdown for storing or syncing.
- `testomatioEditorClassName` gives you the `markdown` wrapper class so the editor inherits the same Tailwind typography styles as your read-only view.

4. **Blocks Available**

   - `testCase`: rich-text wrapper with status and reference metadata.
   - `testStep`: inline WYSIWYG inputs for Step Title, Data, and Expected Result with bold/italic/underline formatting.

## Step Autocomplete & Image Upload Hooks

Configure everything via JS—no React providers required:

```ts
import {
  customSchema,
  setGlobalStepSuggestionsFetcher,
  setGlobalStepImageUploadHandler,
} from "testomatio-editor-blocks";

// Step suggestions (fetch or return an array of { id, title, ... })
setGlobalStepSuggestionsFetcher(async () => {
  const res = await fetch("https://api.testomatio.com/v1/steps");
  return res.json();
});

// Image upload uses BlockNote's `uploadFile` handler you pass to `useCreateBlockNote`.
// No extra setup is required for step fields.
```

Step suggestions accept either an array of `{ id, title, ... }` or the JSON:API shape:

```json
{
  "data": [
    {
      "id": "145",
      "type": "step",
      "attributes": {
        "title": "Donec placerat, dui vitae",
        "description": null,
        "kind": "manual",
        "labels": [],
        "keywords": [],
        "usage-count": 23,
        "comments-count": 0,
        "is-snippet": null
      }
    }
  ]
}
```

When a user types in Step Title, autocomplete filters these titles; Tab/Enter/Ctrl/Cmd+Space or the ⌄ button will insert the selection.

## Running Tests

Vitest covers the Markdown/block converter. Run the suite with:

```bash
npm run test:run
```

Use `npm run test` if you prefer the interactive watcher.

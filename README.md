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

   - `testStep`: inline WYSIWYG inputs for Step Title, Data, and Expected Result with bold/italic/underline formatting/images.
   - `snippet`: dropdown to pick a reusable snippet and editable body (no formatting buttons).

5. **Spellcheck**

   Step and snippet fields inherit the browser's `spellcheck` setting from the editor container, so it is enabled by default. To turn it off for the whole editor (paragraphs and steps), set `spellcheck="false"` on any wrapper around `BlockNoteView`.

## Test and Suite Header

`<!-- test -->` and `<!-- suite -->` comments render as a card that folds open into their fields. Shut, it shows the id, the first filled field and how many more. The `+` button adds a field from `getMetaFieldSuggestions`. The card is read-only when the editor is not editable.

The same card is exported for read-only views outside the editor:

```tsx
import { TestMetaCard } from "testomatio-editor-blocks";

<TestMetaCard kind="test" fields={[{ key: "id", value: "@T1234abcd" }]} onChange={() => {}} readOnly />
```

## Theming

Every color, font and size comes from a `--tme-*` token. Defaults are the Testomat.io look. Set the tokens on any ancestor of the editor (or `:root`) to restyle it. Dark values switch on `html.dark`.

| Token | Default (light) | Used for |
| --- | --- | --- |
| `--tme-font-sans` / `--tme-font-mono` | Inter / system mono | Text / ids |
| `--tme-text-size` / `--tme-leading` | 14px / 20px | Step fields |
| `--tme-h1` … `--tme-h6` | 22 / 20 / 18 / 16 / 14 / 14px | Headings |
| `--tme-fg` | #262626 | Text |
| `--tme-fg-strong` / `--tme-fg-soft` | #0a0a0a / #404040 | Icons / step buttons |
| `--tme-muted-fg` / `--tme-placeholder` | #737373 / #a1a1a1 | Labels / placeholders |
| `--tme-border` / `--tme-border-strong` | #e5e5e5 / #d4d4d4 | Borders |
| `--tme-surface` / `--tme-surface-hover` | #fff / #fafafa | Popovers, menus |
| `--tme-muted` | slate 5% | Soft fills |
| `--tme-primary` / `--tme-ring` | #4f46e5 / its 25% | Focus, open card |
| `--tme-link` / `--tme-code` / `--tme-danger` | indigo / amber / red | Links / code / remove |
| `--tme-tooltip-bg` / `--tme-tooltip-fg` | #0a0a0a / #fafafa | Tooltips |
| `--tme-shadow` / `--tme-radius` | 12% black / 8px | Popovers / corners |
| `--tme-meta-bg` / `--tme-meta-border` / `--tme-meta-border-open` | muted / border / primary 50% | Test and suite header |
| `--tme-meta-gap` | 2rem | Space above each test |

Step and snippet blocks also keep their older `--step-*` and `--snippet-*` variables.

```css
.my-editor {
  --tme-font-sans: var(--font-sans);
  --tme-fg: var(--foreground);
  --tme-primary: var(--primary);
}
```

## Headless Parser

`testomatio-editor-blocks/markdown` holds the Markdown parser and serializer without React, BlockNote or a DOM, so a server can read test files with the same rules as the editor.

```ts
import { parseTestDocument, metaFieldValue, splitTags } from "testomatio-editor-blocks/markdown";

for (const section of parseTestDocument(markdown)) {
  // section.meta: { kind: "test" | "suite", fields, inline } | null
  // section.start / bodyStart / end: 0-based lines, end exclusive
  // section.heading: the first # or ## heading; section.steps: { title, data, expected }
  const id = metaFieldValue(section.meta, "id");
  const { title, tags } = splitTags(section.heading?.text ?? "");
}
```

It also exports `markdownToBlocks`, `blocksToMarkdown`, `scanMarkdownBlocks` (blocks with their source lines), `isStepsHeading` and `getMetaFieldSuggestions`.

## Step Autocomplete & Image Upload Hooks

Configure everything via JS—no React providers required:

```ts
import {
  customSchema,
  setStepsFetcher,
} from "testomatio-editor-blocks";
import { setSnippetFetcher } from "testomatio-editor-blocks/snippets";

// Step suggestions (fetch or return an array of { id, title, ... })
setStepsFetcher(async () => {
  const res = await fetch("https://api.testomatio.com/v1/steps");
  return res.json();
});

setSnippetFetcher(async () => {
  const res = await fetch("https://api.testomatio.com/v1/snippets");
  return res.json();
});

// Image upload uses BlockNote's `uploadFile` handler you pass to `useCreateBlockNote`.
// No extra setup is required for step/snippet fields.
```

For snippets, provide a suggestions fetcher that returns `{ id, title, body, ... }` or a JSON:API document and map it with `setSnippetFetcher`. Selecting a snippet fills its body; Markdown is wrapped with `<!-- begin snippet #id --> ... <!-- end snippet #id -->`.

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

To stop suggestions from popping up while typing, set `data-step-autocomplete="false"` on any ancestor of the editor (for example the element the editor is mounted into). The "Show suggestions" button and Ctrl/Cmd+Space still open the list. The attribute is read on every edit, so toggling it takes effect immediately; `isStepAutocompleteOnTypeEnabled(element)` exposes the same check.

## Running Tests

Vitest covers the Markdown/block converter. Run the suite with:

```bash
npm run test:run
```

Use `npm run test` if you prefer the interactive watcher.

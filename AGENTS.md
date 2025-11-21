# Testomatio Editor Blocks – Agent Guide

## Overview

This repo packages custom [BlockNote](https://blocknotejs.org/) blocks, markdown converters, and minimal UI helpers for Testomatio-style step/snippet documentation. Consumers import the package, register `customSchema`, and get step/snippet blocks ready to insert into any BlockNote editor instance. The playground in `src/App.tsx` demonstrates the package wiring (fetchers, image upload, autofocus, selection helpers). When contributing, ensure new functionality works inside the package (no direct edits to the demo app).

## Code Map

| Path | Purpose |
| --- | --- |
| `src/editor/blocks/step.tsx` | Step block spec (`testStep`). Renders Step Title/Data/Expected fields via `StepField`, handles autocomplete, image upload, inline insert (`+ Step`), and block selection. |
| `src/editor/blocks/snippet.tsx` | Snippet block spec (`snippet`). Uses `StepField` for title/data, shows empty state when no snippets exist, responds to snippet fetcher selection. |
| `src/editor/blocks/stepField.tsx` | Shared editable field component (markdown support, toolbar, image paste/upload, autocomplete). Emits `onFieldFocus` so parent blocks can set selection. |
| `src/editor/blocks/markdown.ts` | Markdown ↔ HTML helpers reused by `StepField` and exported for consumers. |
| `src/editor/customSchema.tsx` | Creates the BlockNote schema combining default specs + `testStep`/`snippet`. Exports types (`CustomSchema`, `CustomBlock`, etc.) and markdown helpers for tests. |
| `src/editor/customMarkdownConverter.ts` | Blocks ↔ Markdown serializer/deserializer for Testomatio format (steps, snippets, tables, etc.). |
| `src/editor/stepAutocomplete.tsx` / `snippetAutocomplete.ts` | Hooks + fetcher setters for step/snippet autocomplete (set with `setStepsFetcher`, `setSnippetFetcher`). |
| `src/editor/stepImageUpload.ts` | Global image upload handler used by StepField. |
| `src/snippets.ts` | Package entrypoint exporting snippet-specific helpers (so consumers can `import { setSnippetFetcher } from "…/snippets"`). |
| `src/index.ts` | Default package entrypoint exporting schema, block specs, converters, hooks, and class names. |
| `src/editor/blocks/blocks.test.ts` + other `*.test.ts` | Vitest coverage for converters, shared helpers, and fetchers. |
| `scripts/build-package.mjs` | Emits compiled JS/typings into `package/` (used during `npm run build`). Make sure tsconfig includes new entrypoints if you add files. |

## Adding or Editing Blocks

1. **Create a block spec** under `src/editor/blocks/`. Follow the `createReactBlockSpec` pattern used by `step.tsx`/`snippet.tsx`. Keep UI logic inside the block spec so consumers get functionality by installing the package—avoid relying on the playground (`App.tsx`).
2. **Reuse StepField** when possible. If your block needs custom fields, consider extending `StepField` or adding new shared components under `src/editor/blocks/`.
3. **Update the schema**: register your block in `src/editor/customSchema.tsx` and re-export it from `src/index.ts` so consumers can import the block spec directly if needed.
4. **Markdown conversion**: extend `src/editor/customMarkdownConverter.ts` (`serializeBlock` and parser helpers) so the new block round-trips between BlockNote and Markdown. Add tests in `src/editor/customMarkdownConverter.test.ts`.
5. **Styles**: add CSS to `src/editor/styles.css` (e.g., `.bn-myblock`). Remember build-package copies this file into the package root.
6. **Package exports**: if you add new entrypoints (e.g., `testomatio-editor-blocks/something`), update `package.json` exports and include the source path in `tsconfig.package.json`.
7. **Docs**: update README to explain new blocks, fetchers, or globals consumers must supply.

## Autofocus & Selection

Blocks must manage selection themselves since the package is consumed in different hosts:

- Use `StepField`’s `autoFocus` for initial focus (only triggers on first render when the value is empty).
- Implement `onFieldFocus` to call `editor.setSelection(block.id, block.id)` so deleting removes the correct block.
- For bulk insert (e.g., slash menu), call `editor.insertBlocks` and explicitly focus the new block (see `handleInsertNextStep` in `step.tsx`).

## Fetchers & Image Upload

- `setStepsFetcher(fetcher)` and `setSnippetFetcher(fetcher)` register global suggestion providers. Fetchers may return arrays of suggestions or JSON:API responses (`parseStepsFromJsonApi`/`parseSnippetsFromJsonApi` help convert).
- `setImageUploadHandler(handler)` configures the global upload for StepField image buttons/paste. The demo wires it to BlockNote’s `uploadFile` fallback.

## Running Tests & Build

Vitest is configured but currently exits without printing results in some environments. Locally:

```bash
npm run build         # Type-checks, builds package/, bundles playground
npm run test:run      # vitest run (should pass locally, but watch for silent exits)
```

If Vitest emits nothing in CI, reproduce locally to diagnose. Converters/tests live in `src/editor/*.test.ts`.

## Publishing Checklist

1. Update `package.json` version & exports if new entrypoints.
2. Ensure `tsconfig.package.json` includes any new source files.
3. Run `npm run build`.
4. Verify `package/` contains JS + `.d.ts` for new modules (e.g., `package/snippets.js`).
5. Publish with `npm publish` from repo root.

With this structure, future AI agents can add new blocks by copying the existing patterns, extending converters/tests, and updating exports/documentation. Remember: keep block logic inside the block spec so consumers don’t need to modify their host app to get core functionality (autocomplete, autofocus, image upload, etc.).***

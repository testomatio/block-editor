# Block Editor Playground

This package hosts the BlockNote playground used for experimenting with Test Case and Test Step blocks, Markdown conversion, and the live preview tools.

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

## Running Tests

Vitest covers the Markdown/block converter. Run the suite with:

```bash
npm run test:run
```

Use `npm run test` if you prefer the interactive watcher.

# Changelog

## 0.4.93

- Test and suite header is a card that folds open: `Test` / `Suite` label, id, first field and `+N` when shut, `No details` when empty, `+` adds a field. It is read-only when the editor is not editable.
- `TestMetaCard` is exported for read-only views.
- New `--tme-*` theme tokens for every color, font and size. Defaults keep the Testomat.io look. Most `html.dark` overrides moved into the tokens.
- New headless entry `testomatio-editor-blocks/markdown`: `parseTestDocument`, `metaFieldValue`, `scanMarkdownBlocks`, `splitTags` plus the converters, with no React or BlockNote at runtime.
- Header markup changed: `.bn-testmeta__summary` is a span inside `.bn-testmeta__trigger`; `.bn-testmeta--expanded/--collapsed` became `.bn-testmeta--open`; `.bn-testmeta__toggle` became `.bn-testmeta__chevron`; `.bn-testmeta__key--input` was folded into `.bn-testmeta__key`.
- Dark mode: a few near-identical greys were merged (step preview text, snippet chevron, link tooltip url).

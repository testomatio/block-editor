import { createReactBlockSpec } from "@blocknote/react";

/**
 * A read-only marker rendered from the `<!-- example -->` HTML comment that
 * precedes a data/examples table in a testomat.io test file. It shows a compact
 * "examples" panel (a cropped variant of the SUITE/TEST metadata bar) so the
 * marker reads as a UI label instead of raw comment text. It has no fields and
 * round-trips back to `<!-- example -->` on serialize.
 */
export const exampleMarkerBlock = createReactBlockSpec(
  { type: "exampleMarker", content: "none", propSchema: {} },
  {
    render: () => (
      <div
        className="bn-example-marker"
        contentEditable={false}
        suppressContentEditableWarning
        draggable={false}
      >
        <span className="bn-example-marker__label">examples</span>
      </div>
    ),
  },
);

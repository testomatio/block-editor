import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { setImageUploadHandler, useStepImageUpload, type StepImageUploadHandler } from "./stepImageUpload";

describe("image upload handler hook", () => {
  it("returns the configured upload handler", async () => {
    const handler: StepImageUploadHandler = async () => ({ url: "https://example.com/image.png" });
    setImageUploadHandler(handler);

    let seen: any;
    const Probe = () => {
      seen = useStepImageUpload();
      return null;
    };

    renderToStaticMarkup(React.createElement(Probe));

    expect(seen).toBe(handler);
    const result = await (seen as StepImageUploadHandler)(new Blob(["demo"], { type: "image/png" }));
    expect(result).toEqual({ url: "https://example.com/image.png" });

    setImageUploadHandler(null);
  });
});

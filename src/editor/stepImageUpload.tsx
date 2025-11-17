import { useEffect, useState } from "react";

export type StepImageUploadHandler = (image: Blob) => Promise<{ url: string }>;

let globalUploadHandler: StepImageUploadHandler | null = null;

export function setGlobalStepImageUploadHandler(handler: StepImageUploadHandler | null) {
  globalUploadHandler = handler;
}

export function useStepImageUpload(): StepImageUploadHandler | null {
  const [handler, setHandler] = useState<StepImageUploadHandler | null>(globalUploadHandler);

  useEffect(() => {
    setHandler(globalUploadHandler);
  }, []);

  return handler;
}

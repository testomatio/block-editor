export type StepImageUploadHandler = (image: Blob) => Promise<{ url: string }>;

let imageUploadHandler: StepImageUploadHandler | null = null;

export function setImageUploadHandler(handler: StepImageUploadHandler | null) {
  imageUploadHandler = handler;
}

export function useStepImageUpload(): StepImageUploadHandler | null {
  return imageUploadHandler;
}

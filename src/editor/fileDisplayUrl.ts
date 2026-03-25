export type FileDisplayUrlResolver = (fileUrl: string) => string;

let resolver: FileDisplayUrlResolver | null = null;

export function setFileDisplayUrlResolver(fn: FileDisplayUrlResolver | null) {
  resolver = fn;
}

export function resolveFileDisplayUrl(fileUrl: string): string {
  if (resolver) {
    return resolver(fileUrl);
  }
  try {
    const urlPath = new URL(fileUrl).pathname;
    if (urlPath.includes(".")) {
      const ext = urlPath.split(".").pop()?.toLowerCase() || "";
      if (ext) {
        return `/images/file-type-icons/${ext}.svg`;
      }
    }
  } catch {}
  return `/images/file-type-icons/file.svg`;
}

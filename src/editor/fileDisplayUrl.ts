export type FileDisplayUrlResolver = (fileName: string) => string;

let resolver: FileDisplayUrlResolver | null = null;

export function setFileDisplayUrlResolver(fn: FileDisplayUrlResolver | null) {
  resolver = fn;
}

export function resolveFileDisplayUrl(fileName: string, fallbackUrl: string): string {
  if (resolver) {
    return resolver(fileName);
  }
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (ext) {
    return `/images/file-type-icons/${ext}.svg`;
  }
  return fallbackUrl;
}

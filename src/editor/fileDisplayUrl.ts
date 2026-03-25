export type FileDisplayUrlResolver = (fileUrl: string) => string;

let resolver: FileDisplayUrlResolver | null = null;

export function setFileDisplayUrlResolver(fn: FileDisplayUrlResolver | null) {
  resolver = fn;
}

export function resolveFileDisplayUrl(fileUrl: string): string {
  if (resolver) {
    return resolver(fileUrl);
  }
  return `/images/file-type-icons/file.svg`;
}

const IMAGE_MARKDOWN_REGEX = /!\[([^\]]*)\]\(([^)]+?)(?:\s+=\d+x(?:\d+|\*))?\)/g;
const MARKDOWN_ESCAPE_REGEX = /([*_\\])/g;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type InlineSegment = {
  text: string;
  styles: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
  };
};

function restoreEscapes(text: string): string {
  return text.replace(/\uE000/g, "\\");
}

function findItalicClose(
  text: string,
  start: number,
  marker: "*" | "_",
): number {
  let j = start;
  while (j < text.length) {
    const ch = text[j];
    if (ch === "\uE000") {
      j += 2;
      continue;
    }
    if ((ch === "*" || ch === "_") && text[j + 1] === ch) {
      const close = text.indexOf(ch + ch, j + 2);
      if (close === -1) {
        return -1;
      }
      j = close + 2;
      continue;
    }
    if (ch === marker) {
      return j;
    }
    j += 1;
  }
  return -1;
}

function parseInlineSegments(
  normalized: string,
  outer: { bold: boolean; italic: boolean; underline: boolean },
): InlineSegment[] {
  const result: InlineSegment[] = [];
  let buffer = "";

  const pushPlain = () => {
    if (!buffer) return;
    result.push({ text: restoreEscapes(buffer), styles: { ...outer } });
    buffer = "";
  };

  const wrap = (
    inner: string,
    add: Partial<{ bold: boolean; italic: boolean; underline: boolean }>,
  ) => {
    pushPlain();
    result.push(...parseInlineSegments(inner, { ...outer, ...add }));
  };

  let i = 0;
  while (i < normalized.length) {
    if (normalized.startsWith("***", i)) {
      const end = normalized.indexOf("***", i + 3);
      if (end !== -1) {
        wrap(normalized.slice(i + 3, end), { bold: true, italic: true });
        i = end + 3;
        continue;
      }
    }
    if (normalized.startsWith("___", i)) {
      const end = normalized.indexOf("___", i + 3);
      if (end !== -1) {
        wrap(normalized.slice(i + 3, end), { bold: true, italic: true });
        i = end + 3;
        continue;
      }
    }
    if (normalized.startsWith("**", i)) {
      const end = normalized.indexOf("**", i + 2);
      if (end !== -1) {
        wrap(normalized.slice(i + 2, end), { bold: true });
        i = end + 2;
        continue;
      }
    }
    if (normalized.startsWith("__", i)) {
      const end = normalized.indexOf("__", i + 2);
      if (end !== -1) {
        wrap(normalized.slice(i + 2, end), { bold: true });
        i = end + 2;
        continue;
      }
    }
    if (normalized.startsWith("<u>", i)) {
      const end = normalized.indexOf("</u>", i + 3);
      if (end !== -1) {
        wrap(normalized.slice(i + 3, end), { underline: true });
        i = end + 4;
        continue;
      }
    }
    if (normalized[i] === "*" || normalized[i] === "_") {
      const marker = normalized[i] as "*" | "_";
      const end = findItalicClose(normalized, i + 1, marker);
      if (end !== -1) {
        wrap(normalized.slice(i + 1, end), { italic: true });
        i = end + 1;
        continue;
      }
    }

    buffer += normalized[i];
    i += 1;
  }

  pushPlain();
  return result;
}

function parseInlineMarkdown(text: string): InlineSegment[] {
  if (!text) {
    return [];
  }

  const normalized = text.replace(/\\([*_`~])/g, "\uE000$1");
  return parseInlineSegments(normalized, {
    bold: false,
    italic: false,
    underline: false,
  });
}

function inlineToHtml(inline: InlineSegment[]): string {
  return inline
    .map(({ text, styles }) => {
      let html = escapeHtml(text);
      if (styles.bold) {
        html = `<strong>${html}</strong>`;
      }
      if (styles.italic) {
        html = `<em>${html}</em>`;
      }
      if (styles.underline) {
        html = `<u>${html}</u>`;
      }
      return html;
    })
    .join("");
}

export function markdownToHtml(markdown: string): string {
  if (!markdown) {
    return "";
  }

  const lines = markdown.split(/\n/);
  const htmlLines = lines.map((line) => {
    const inline = parseInlineMarkdown(line);
    const html = inlineToHtml(inline);
    if (!html) {
      return html;
    }

    return html.replace(
      IMAGE_MARKDOWN_REGEX,
      (_match, alt = "", src = "") =>
        `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="bn-inline-image" contenteditable="false" draggable="false" />`,
    );
  });
  return htmlLines.join("<br />");
}

export function escapeMarkdownText(text: string): string {
  return text.replace(MARKDOWN_ESCAPE_REGEX, "\\$1");
}

export function normalizePlainText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function fallbackHtmlToMarkdown(html: string): string {
  if (!html) {
    return "";
  }

  let result = html;

  result = result.replace(/<img[^>]*>/gi, (match) => {
    const src = match.match(/src="([^"]*)"/i)?.[1] ?? "";
    const alt = match.match(/alt="([^"]*)"/i)?.[1] ?? "";
    return `![${alt}](${src})`;
  });

  result = result
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(div|p)>/gi, "\n")
    .replace(/<strong>(.*?)<\/strong>/gis, (_m, content) => `**${content}**`)
    .replace(/<(em|i)>(.*?)<\/(em|i)>/gis, (_m, _tag, content) => `_${content}_`)
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<u>(.*?)<\/u>/gis, (_m, content) => `<u>${content}</u>`);

  result = result.replace(/<\/?[^>]+>/g, "");

  const markdown = result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleanupEscapedFormatting(markdown);
}

export function htmlToMarkdown(html: string): string {
  if (typeof document === "undefined") {
    return fallbackHtmlToMarkdown(html);
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;

  const traverse = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      return escapeMarkdownText(text);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const element = node as HTMLElement;
    const children = Array.from(element.childNodes)
      .map(traverse)
      .join("");

    switch (element.tagName.toLowerCase()) {
      case "strong":
      case "b":
        return children ? `**${children}**` : children;
      case "em":
      case "i":
        return children ? `*${children}*` : children;
      case "u":
        return children ? `<u>${children}</u>` : children;
      case "br":
        return "\n";
      case "div":
      case "p":
        return children + "\n";
      case "img": {
        const src = element.getAttribute("src") ?? "";
        const alt = element.getAttribute("alt") ?? "";
        return `![${alt}](${src})`;
      }
      default:
        return children;
    }
  };

  const markdown = Array.from(temp.childNodes).map(traverse).join("");
  return cleanupEscapedFormatting(markdown).replace(/\n{3,}/g, "\n\n").trim();
}

function cleanupEscapedFormatting(markdown: string): string {
  return markdown.replace(/(\\+)([*_]+)/g, (_match, slashes, markers) => {
    if (markers.length === 0) {
      return slashes + markers;
    }
    const shouldClean =
      markers.length === 3 ||
      markers.length === 2 ||
      markers.length === 1;
    if (!shouldClean) {
      return slashes + markers;
    }
    const hasPrintable = slashes.length % 2 === 0;
    return hasPrintable ? markers : slashes + markers;
  });
}

export const __markdownStringUtils = {
  cleanupEscapedFormatting,
};

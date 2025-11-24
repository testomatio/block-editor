const IMAGE_MARKDOWN_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
const MARKDOWN_ESCAPE_REGEX = /([*_\\])/g;
const INLINE_SEGMENT_REGEX =
  /(\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|<u>[^<]+<\/u>)/;

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

function parseInlineMarkdown(text: string): InlineSegment[] {
  if (!text) {
    return [];
  }

  const normalized = text.replace(/\\([*_`~])/g, "\uE000$1");
  const rawSegments = normalized.split(INLINE_SEGMENT_REGEX).filter(Boolean);

  return rawSegments.map((segment) => {
    const baseStyles = { bold: false, italic: false, underline: false };

    if (/^\*\*\*(.+)\*\*\*$/.test(segment) || /^___(.+)___$/.test(segment)) {
      const content = segment.slice(3, -3);
      return {
        text: restoreEscapes(content),
        styles: { bold: true, italic: true, underline: false },
      };
    }

    if (/^\*\*(.+)\*\*$/.test(segment) || /^__(.+)__$/.test(segment)) {
      const content = segment.slice(2, -2);
      return {
        text: restoreEscapes(content),
        styles: { ...baseStyles, bold: true },
      };
    }

    if (/^\*(.+)\*$/.test(segment) || /^_(.+)_$/.test(segment)) {
      const content = segment.slice(1, -1);
      return {
        text: restoreEscapes(content),
        styles: { ...baseStyles, italic: true },
      };
    }

    if (/^<u>(.+)<\/u>$/.test(segment)) {
      const content = segment.slice(3, -4);
      return {
        text: restoreEscapes(content),
        styles: { ...baseStyles, underline: true },
      };
    }

    return {
      text: restoreEscapes(segment),
      styles: { ...baseStyles },
    };
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
    .replace(/<(em|i)>(.*?)<\/(em|i)>/gis, (_m, _tag, content) => `*${content}*`)
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

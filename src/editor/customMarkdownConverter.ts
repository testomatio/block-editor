import {
  isLinkInlineContent,
  isStyledTextInlineContent,
} from "@blocknote/core";
import type {
  Block,
  InlineContent,
  PartialBlock,
  Styles,
} from "@blocknote/core";
import type { customSchema } from "./customSchema";

// Types derived from the custom schema so the converter stays type-safe when the schema evolves.
type Schema = typeof customSchema;
export type CustomEditorBlock = Block<
  Schema["blockSchema"],
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>;
export type CustomPartialBlock = PartialBlock<
  Schema["blockSchema"],
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>;
type EditorInline = InlineContent<
  Schema["inlineContentSchema"],
  Schema["styleSchema"]
>;
type EditorStyles = Styles<Schema["styleSchema"]>;

const BASE_BLOCK_PROPS = {
  textAlignment: "left" as const,
  textColor: "default" as const,
  backgroundColor: "default" as const,
};

const BASE_CELL_PROPS = {
  backgroundColor: "default" as const,
  textColor: "default" as const,
  textAlignment: "left" as const,
};

const TABLE_BLOCK_PROPS = {
  textColor: "default" as const,
};

type MarkdownContext = {
  listDepth: number;
  insideQuote: boolean;
};

const headingPrefixes: Record<number, string> = {
  1: "#",
  2: "##",
  3: "###",
  4: "####",
  5: "#####",
  6: "######",
};

const SPECIAL_CHAR_REGEX = /([*_`~\[\]()<>\\])/g;
const HTML_SPAN_REGEX = /<\/?span[^>]*>/g;
const HTML_UNDERLINE_REGEX = /<\/?u>/g;
const EXPECTED_LABEL_REGEX = /^(?:[*_`]*\s*)?(expected(?:\s+result)?)\s*(?:[*_`]*\s*)?(?:\s*[:\-–—]?\s*)/i;
// Matches any non-empty line that falls between the step title and the expected result line.
const STEP_DATA_LINE_REGEX =
  /^(?!\s*(?:[*_`]*\s*)?(?:expected(?:\s+result)?)\b).+/i;
const NUMBERED_STEP_REGEX = /^\d+[.)]\s+/;

function escapeMarkdown(text: string): string {
  return text.replace(SPECIAL_CHAR_REGEX, "\\$1");
}

function stripHtmlWrappers(text: string): string {
  return text
    .replace(HTML_SPAN_REGEX, "")
    .replace(HTML_UNDERLINE_REGEX, "");
}

function stripExpectedPrefix(text: string): string {
  const match = text.match(EXPECTED_LABEL_REGEX);
  if (!match) {
    return text;
  }
  const label = match[0];
  let remainder = text.slice(label.length).trimStart();

  const cleanupLeading = (value: string) => {
    let result = value.trimStart();
    result = result.replace(/^\\+(?=[*_`~:[\]])/, "");
    result = result.replace(/^(?:[*_`~]+)(?=\s|$)/, "");
    return result.trimStart();
  };

  remainder = cleanupLeading(remainder);
  remainder = stripLeadingFormatting(remainder);
  return remainder.trimStart();
}

function stripLeadingFormatting(text: string): string {
  let result = text.trimStart();
  let changed = true;
  while (changed) {
    changed = false;

    // Remove escaped markers like \* or \_ at the start
    if (/^\\+[*_`~]/.test(result)) {
      result = result.replace(/^\\+/, "");
      changed = true;
      result = result.trimStart();
      continue;
    }

    // Remove leading sequences of markdown emphasis markers
    const leadingMarkers = result.match(/^([*_`~]{1,3})(\s+|$)/);
    if (leadingMarkers) {
      result = result.slice(leadingMarkers[1].length).trimStart();
      changed = true;
      continue;
    }
  }
  return result;
}

function unescapeMarkdown(text: string): string {
  return stripHtmlWrappers(text).replace(/\\([*_`~\[\]()<>\\])/g, "$1");
}

function applyTextStyles(text: string, styles: EditorStyles | undefined): string {
  if (!styles) {
    return text;
  }

  const hasCode = styles.code === true;
  let result = text;

  if (hasCode) {
    result = "`" + result.replace(/`/g, "\\`") + "`";
    // Code style supersedes other styles in Markdown.
    return result;
  }

  const wrappers: Array<{ prefix: string; suffix?: string }> = [];

  if (styles.bold) {
    wrappers.push({ prefix: "**", suffix: "**" });
  }

  if (styles.italic) {
    wrappers.push({ prefix: "*", suffix: "*" });
  }

  if (styles.strike) {
    wrappers.push({ prefix: "~~", suffix: "~~" });
  }

  if (styles.underline) {
    wrappers.push({ prefix: "<u>", suffix: "</u>" });
  }

  if (styles.textColor && styles.textColor !== "default") {
    wrappers.push({
      prefix: `<span style="color: ${styles.textColor}">`,
      suffix: "</span>",
    });
  }

  if (styles.backgroundColor && styles.backgroundColor !== "default") {
    wrappers.push({
      prefix: `<span style="background-color: ${styles.backgroundColor}">`,
      suffix: "</span>",
    });
  }

  for (const wrapper of wrappers) {
    const suffix = wrapper.suffix ?? wrapper.prefix;
    result = `${wrapper.prefix}${result}${suffix}`;
  }

  return result;
}

function inlineToMarkdown(content: CustomEditorBlock["content"]): string {
  if (!content || !Array.isArray(content)) {
    return "";
  }

  return (content as EditorInline[])
    .map((item) => {
      if (isStyledTextInlineContent(item)) {
        return applyTextStyles(escapeMarkdown(item.text), item.styles);
      }

      if (isLinkInlineContent(item)) {
        const inner = inlineToMarkdown(item.content);
        const safeHref = escapeMarkdown(item.href);
        return `[${inner}](${safeHref})`;
      }

      if (Array.isArray((item as any).content)) {
        return inlineToMarkdown((item as any).content);
      }

      return "";
    })
    .join("");
}

function inlineContentToPlainText(content: CustomEditorBlock["content"]): string {
  if (!Array.isArray(content)) {
    return "";
  }

  return (content as any[])
    .map((node: any) => {
      if (node && typeof node === "object") {
        if (typeof node.text === "string") {
          return node.text;
        }
        if (Array.isArray(node.content)) {
          return inlineContentToPlainText(node.content);
        }
      }
      return "";
    })
    .join("");
}

function serializeChildren(block: CustomEditorBlock, ctx: MarkdownContext): string[] {
  if (!block.children?.length) {
    return [];
  }

  const childCtx = { ...ctx, listDepth: ctx.listDepth + 1 };
  return serializeBlocks(block.children, childCtx);
}

function flattenWithBlankLine(lines: string[], appendBlank = false): string[] {
  if (appendBlank && (lines.length === 0 || lines.at(-1) !== "")) {
    return [...lines, ""];
  }
  return lines;
}

function serializeBlock(
  block: CustomEditorBlock,
  ctx: MarkdownContext,
  orderedIndex?: number,
): string[] {
  const lines: string[] = [];
  const indent = ctx.listDepth > 0 ? "  ".repeat(ctx.listDepth) : "";

  switch (block.type) {
    case "paragraph": {
      const text = inlineToMarkdown(block.content);
      if (text.length > 0) {
        lines.push(ctx.insideQuote ? `> ${text}` : text);
      }
      return flattenWithBlankLine(lines, !ctx.insideQuote);
    }
    case "heading": {
      const level = (block.props as any).level ?? 1;
      const prefix = headingPrefixes[level] ?? headingPrefixes[3];
      const text = inlineToMarkdown(block.content);
      lines.push(`${prefix} ${text}`.trimEnd());
      return flattenWithBlankLine(lines, true);
    }
    case "quote": {
      const quoteContent = serializeBlocks(block.children ?? [], {
        ...ctx,
        listDepth: ctx.listDepth,
        insideQuote: true,
      });
      if (block.content?.length) {
        const quoteText = inlineToMarkdown(block.content)
          .split(/\n/)
          .map((fragment) => `> ${fragment}`);
        lines.push(...quoteText);
      }
      lines.push(...quoteContent.map((line) => (line ? `> ${line}` : ">")));
      return flattenWithBlankLine(lines, true);
    }
    case "codeBlock": {
      const language = (block.props as any).language || "";
      const fence = "```" + language;
      const body = inlineToMarkdown(block.content);
      lines.push(fence);
      if (body.length > 0) {
        lines.push(body);
      }
      lines.push("```");
      return flattenWithBlankLine(lines, true);
    }
    case "bulletListItem": {
      const text = inlineToMarkdown(block.content);
      lines.push(`${indent}- ${text}`.trimEnd());
      lines.push(...serializeChildren(block, ctx));
      return lines;
    }
    case "numberedListItem": {
      const number = orderedIndex ??
        (typeof (block.props as any).start === "number"
          ? (block.props as any).start
          : 1);
      const text = inlineToMarkdown(block.content);
      lines.push(`${indent}${number}. ${text}`.trimEnd());
      lines.push(...serializeChildren(block, ctx));
      return lines;
    }
    case "checkListItem": {
      const checked = (block.props as any).checked ? "x" : " ";
      const text = inlineToMarkdown(block.content);
      lines.push(`${indent}- [${checked}] ${text}`.trimEnd());
      lines.push(...serializeChildren(block, ctx));
      return lines;
    }
    case "testStep":
    case "snippet": {
      const isSnippet = block.type === "snippet";
      const snippetId = isSnippet ? (((block.props as any).snippetId ?? "") as string).trim() : "";
      const stepTitle = isSnippet
        ? ((block.props as any).snippetTitle ?? "").trim()
        : ((block.props as any).stepTitle ?? "").trim();
      const stepData = isSnippet
        ? ((block.props as any).snippetData ?? "").trim()
        : ((block.props as any).stepData ?? "").trim();
      const expectedResult = isSnippet
        ? ((block.props as any).snippetExpectedResult ?? "").trim()
        : ((block.props as any).expectedResult ?? "").trim();

      if (isSnippet) {
        if (snippetId) {
          lines.push(`<!-- begin snippet #${snippetId} -->`);
        }

        const dataLines = stepData
          .split(/\r?\n/)
          .filter((line: string) => !/^<!--\s*(begin|end)\s+snippet/i.test(line.trim()));
        if (dataLines.length > 0) {
          lines.push(...dataLines);
        }

        if (snippetId) {
          lines.push(`<!-- end snippet #${snippetId} -->`);
        }

        return flattenWithBlankLine(lines, true);
      }

      if (stepTitle.length > 0) {
        const normalizedTitle = stepTitle
          .split(/\r?\n/)
          .map((segment: string) => segment.trim())
          .filter((segment: string) => segment.length > 0)
          .join(" ");

        if (normalizedTitle.length > 0) {
          lines.push(`* ${normalizedTitle}`);
        }
      }

      if (stepData.length > 0) {
        const dataLines = stepData.split(/\r?\n/);
        dataLines.forEach((dataLine: string) => {
          const trimmedLine = dataLine.trim();
          if (trimmedLine.length > 0) {
            lines.push(`  ${trimmedLine}`);
          } else {
            lines.push("  ");
          }
        });
      }

      const normalizedExpected = stripExpectedPrefix(expectedResult).trim();
      if (normalizedExpected.length > 0) {
        const expectedLines = normalizedExpected.split(/\r?\n/);
        const label = "*Expected*";
        expectedLines.forEach((expectedLine: string, index: number) => {
          const trimmedLine = expectedLine.trim();
          if (trimmedLine.length === 0) {
            return;
          }

          if (index === 0) {
            lines.push(`  ${label}: ${trimmedLine}`);
          } else {
            lines.push(`  ${trimmedLine}`);
          }
        });
      }

      if (lines.length === 0) {
        return lines;
      }

      return flattenWithBlankLine(lines, false);
    }
    case "table": {
      const tableContent = block.content as any;
      if (!tableContent || tableContent.type !== "tableContent") {
        return flattenWithBlankLine(lines, true);
      }

      const rows: any[] = Array.isArray(tableContent.rows)
        ? tableContent.rows
        : [];

      if (rows.length === 0) {
        return flattenWithBlankLine(lines, true);
      }

      const columnCount = rows.reduce((max, row) => {
        const length = Array.isArray(row.cells) ? row.cells.length : 0;
        return Math.max(max, length);
      }, 0);

      if (columnCount === 0) {
        return flattenWithBlankLine(lines, true);
      }

      const headerRowCount = rows.length
        ? Math.min(rows.length, Math.max(tableContent.headerRows ?? 1, 1))
        : 0;

      const columnAlignments: Array<"left" | "center" | "right" | "justify"> =
        new Array(columnCount).fill("left");

      const getCellAlignment = (
        cell: any,
      ): "left" | "center" | "right" | "justify" => {
        if (cell && typeof cell === "object" && cell.props?.textAlignment) {
          return cell.props.textAlignment;
        }
        return "left";
      };

      const getCellText = (cell: any): string => {
        if (Array.isArray(cell)) {
          return inlineToMarkdown(cell as any);
        }
        if (cell && typeof cell === "object" && Array.isArray(cell.content)) {
          return inlineToMarkdown(cell.content as any);
        }
        return "";
      };

      rows.forEach((row: any) => {
        if (!Array.isArray(row.cells)) {
          return;
        }
        row.cells.forEach((cell: any, index: number) => {
          const alignment = getCellAlignment(cell);
          if (alignment !== "left") {
            columnAlignments[index] = alignment;
          }
        });
      });

      const normalizeRow = (row: any): string[] => {
        const cells = Array.isArray(row.cells) ? row.cells : [];
        const cellTexts = cells.map(getCellText);
        while (cellTexts.length < columnCount) {
          cellTexts.push("");
        }
        return cellTexts;
      };

      const formattedRows = rows.map(normalizeRow);
      const formatCell = (value: string) => (value.length ? value : " ");
      const toAlignmentToken = (alignment: string) => {
        switch (alignment) {
          case "center":
            return ":---:";
          case "right":
            return "---:";
          case "justify":
            return ":---:";
          default:
            return "---";
        }
      };

      const headerRow = formattedRows[0];
      lines.push(
        `| ${headerRow.map((cell) => formatCell(cell)).join(" | ")} |`,
      );
      lines.push(
        `| ${columnAlignments
          .map((alignment) => toAlignmentToken(alignment))
          .join(" | ")} |`,
      );

      const bodyStartIndex = headerRowCount > 0 ? headerRowCount : 1;
      formattedRows.slice(bodyStartIndex).forEach((row) => {
        lines.push(`| ${row.map((cell) => formatCell(cell)).join(" | ")} |`);
      });

      return flattenWithBlankLine(lines, true);
    }
  }

  const fallbackBlock = block as unknown as CustomEditorBlock;
  if (fallbackBlock.content) {
    const text = inlineToMarkdown(fallbackBlock.content);
    if (text.length > 0) {
      lines.push(text);
    }
  }
  lines.push(...serializeChildren(fallbackBlock, ctx));
  return flattenWithBlankLine(lines, false);
}

function serializeBlocks(blocks: CustomEditorBlock[], ctx: MarkdownContext): string[] {
  const lines: string[] = [];
  let orderedIndex: number | null = null;

  for (const block of blocks) {
    if (block.type === "numberedListItem") {
      if (typeof (block.props as any).start === "number") {
        orderedIndex = (block.props as any).start as number;
      } else if (orderedIndex === null) {
        orderedIndex = 1;
      }

      lines.push(...serializeBlock(block, ctx, orderedIndex));
      orderedIndex += 1;
      continue;
    }

    orderedIndex = null;
    lines.push(...serializeBlock(block, ctx));
  }

  return lines;
}

export function blocksToMarkdown(blocks: CustomEditorBlock[]): string {
  const lines = serializeBlocks(blocks, { listDepth: 0, insideQuote: false });
  const cleaned = lines
    // Collapse more than two blank lines into just two for readability.
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  return cleaned;
}

function parseInlineMarkdown(text: string): EditorInline[] {
  const cleaned = stripHtmlWrappers(text);
  const result: EditorInline[] = [];
  let buffer = "";

  const pushPlain = () => {
    if (buffer.length === 0) {
      return;
    }
    result.push({ type: "text", text: unescapeMarkdown(buffer), styles: {} });
    buffer = "";
  };

  let i = 0;
  while (i < cleaned.length) {
    if (cleaned.startsWith("**", i)) {
      const end = cleaned.indexOf("**", i + 2);
      if (end !== -1) {
        pushPlain();
        const inner = cleaned.slice(i + 2, end);
        result.push({
          type: "text",
          text: unescapeMarkdown(inner),
          styles: { bold: true },
        });
        i = end + 2;
        continue;
      }
    }

    if (cleaned.startsWith("~~", i)) {
      const end = cleaned.indexOf("~~", i + 2);
      if (end !== -1) {
        pushPlain();
        const inner = cleaned.slice(i + 2, end);
        result.push({
          type: "text",
          text: unescapeMarkdown(inner),
          styles: { strike: true },
        });
        i = end + 2;
        continue;
      }
    }

    if (cleaned.startsWith("`", i)) {
      const end = cleaned.indexOf("`", i + 1);
      if (end !== -1) {
        pushPlain();
        const inner = cleaned.slice(i + 1, end);
        result.push({
          type: "text",
          text: unescapeMarkdown(inner),
          styles: { code: true },
        });
        i = end + 1;
        continue;
      }
    }

    if (cleaned[i] === "[") {
      const endLabel = cleaned.indexOf("]", i + 1);
      const startLink = cleaned.indexOf("(", endLabel + 1);
      const endLink = cleaned.indexOf(")", startLink + 1);
      if (endLabel !== -1 && startLink === endLabel + 1 && endLink !== -1) {
        pushPlain();
        const label = cleaned.slice(i + 1, endLabel);
        const href = cleaned.slice(startLink + 1, endLink);
        result.push({
          type: "link",
          href: unescapeMarkdown(href),
          content: parseInlineMarkdown(label),
        } as any);
        i = endLink + 1;
        continue;
      }
    }

    if (cleaned.startsWith("*", i)) {
      const end = cleaned.indexOf("*", i + 1);
      if (end !== -1) {
        pushPlain();
        const inner = cleaned.slice(i + 1, end);
        result.push({
          type: "text",
          text: unescapeMarkdown(inner),
          styles: { italic: true },
        });
        i = end + 1;
        continue;
      }
    }

    buffer += cleaned[i];
    i += 1;
  }

  pushPlain();
  return result;
}

function createTextContent(text: string) {
  const inline = parseInlineMarkdown(text.trim());
  return inline.length === 0 ? undefined : inline;
}

function cloneBaseProps() {
  return { ...BASE_BLOCK_PROPS };
}

function cloneCellProps() {
  return { ...BASE_CELL_PROPS };
}

function detectListType(trimmed: string): "bullet" | "numbered" | "check" | null {
  if (/^[-*+]\s+\[[xX\s]\]\s+/.test(trimmed)) {
    return "check";
  }
  if (/^\d+[.)]\s+/.test(trimmed)) {
    return "numbered";
  }
  if (/^[-*+]\s+/.test(trimmed)) {
    return "bullet";
  }
  return null;
}

function countIndent(line: string): number {
  const match = line.match(/^ */);
  return match ? match[0].length : 0;
}

type ListParseResult = {
  items: CustomPartialBlock[];
  nextIndex: number;
};

function parseList(
  lines: string[],
  startIndex: number,
  listType: "bullet" | "numbered" | "check",
  indentLevel: number,
  allowEmptySteps = false,
): ListParseResult {
  const items: CustomPartialBlock[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    let indent = countIndent(rawLine);

    if (indent < indentLevel * 2) {
      break;
    }

    // Check if this line should be parsed as nested content
    // Only go deeper if indent is at least 2 more than the next level's expected indent
    const nextLevelExpectedIndent = (indentLevel + 1) * 2;
    if (indent >= nextLevelExpectedIndent) {
      const lastItem = items.at(-1);
      if (!lastItem) {
        break;
      }
      const nestedType = detectListType(trimmed);
      if (!nestedType) {
        break;
      }
      const nested = parseList(
        lines,
        index,
        nestedType,
        indentLevel + 1,
        allowEmptySteps,
      );
      // If nested parsing made no progress, skip this line to avoid infinite loop
      if (nested.nextIndex === index) {
        index += 1;
        continue;
      }
      lastItem.children = [...(lastItem.children ?? []), ...nested.items];
      index = nested.nextIndex;
      continue;
    }

    const detectedType = detectListType(trimmed);
    if (detectedType !== listType) {
      break;
    }

    // Only try to parse as testStep for top-level bullet items (indentLevel === 0)
    // Nested bullets within numbered lists should remain as regular bulletListItem
    if (listType === "bullet" && indentLevel === 0) {
      const nextStep = parseTestStep(lines, index, allowEmptySteps);
      if (nextStep) {
        items.push(nextStep.block);
        index = nextStep.nextIndex;
        continue;
      }
    }

    if (listType === "check") {
      const checkMatch = trimmed.match(/^[-*+]\s+\[([xX\s])\]\s+(.*)$/);
      const checked = (checkMatch?.[1] ?? "").toLowerCase() === "x";
      const text = checkMatch?.[2] ?? trimmed.slice(6);
      items.push({
        type: "checkListItem",
        props: { ...cloneBaseProps(), checked },
        content: createTextContent(unescapeMarkdown(text)),
        children: [],
      });
    } else if (listType === "numbered") {
      const match = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
      const start = match ? Number(match[1]) : 1;
      const text = match ? match[2] : trimmed;
      items.push({
        type: "numberedListItem",
        props: { ...cloneBaseProps(), start },
        content: createTextContent(unescapeMarkdown(text)),
        children: [],
      });
    } else {
      const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
      const text = bulletMatch?.[1] ?? trimmed.slice(2);
      items.push({
        type: "bulletListItem",
        props: cloneBaseProps(),
        content: createTextContent(unescapeMarkdown(text)),
        children: [],
      });
    }

    index += 1;
  }

  return { items, nextIndex: index };
}

function parseTestStep(
  lines: string[],
  index: number,
  allowEmpty = false,
  snippetId?: string,
): { block: CustomPartialBlock; nextIndex: number } | null {
  const current = lines[index];
  const trimmed = current.trim();
  if (!trimmed.startsWith("* ") && !trimmed.startsWith("- ")) {
    return null;
  }

  let rawTitle = unescapeMarkdown(trimmed.slice(2)).trim();
  let blockType: "testStep" | "snippet" = "testStep";
  const snippetMatch = rawTitle.match(/^snippet\s*[:\-–—]?\s*(.*)$/i);
  if (snippetMatch) {
    blockType = "snippet";
    rawTitle = snippetMatch[1].trim();
  }
  const titleImages: string[] = [];
  const titleWithPlaceholders = rawTitle
    .replace(/!\[[^\]]*\]\(([^)]+)\)/g, (match) => {
      titleImages.push(match);
      return "!";
    })
    .replace(/\s{2,}/g, " ")
    .trim();

  const isLikelyStep =
    blockType === "snippet" ||
    /^step\b/i.test(titleWithPlaceholders) ||
    titleImages.length > 0;
  const stepDataLines: string[] = [];
  let expectedResult = "";
  let next = index + 1;
  let inExpectedResult = false;

  while (next < lines.length) {
    const line = lines[next];
    const hasIndent = /^\s{2,}/.test(line);
    const rawTrimmed = line.trim();

    if (!rawTrimmed) {
      if (stepDataLines.length > 0 || inExpectedResult) {
        if (inExpectedResult) {
          expectedResult += "\n";
        } else {
          stepDataLines.push("");
        }
      }
      next += 1;
      continue;
    }
    const isNumberedStep = NUMBERED_STEP_REGEX.test(rawTrimmed);
    const isNewStep =
      (!hasIndent && (rawTrimmed.startsWith("* ") || rawTrimmed.startsWith("- "))) ||
      (!hasIndent && isNumberedStep);

    if (isNewStep) {
      break;
    }

    if (
      rawTrimmed.startsWith("#") ||
      rawTrimmed.startsWith(":::") ||
      rawTrimmed.startsWith(">") ||
      rawTrimmed.startsWith("|")
    ) {
      break;
    }

    // Check for expected result labels with different formatting
    const expectedMatch = rawTrimmed.match(EXPECTED_LABEL_REGEX);
    const expectedStarMatch = rawTrimmed.match(/^\*expected\s*\*:\s*(.*)$/i) ||
                               rawTrimmed.match(/^\*expected\*:\s*(.*)$/i);

    if (expectedMatch || expectedStarMatch) {
      inExpectedResult = true;
      const label = expectedMatch ? expectedMatch[0] : (expectedStarMatch ? expectedStarMatch[0] : '');
      let content = rawTrimmed.slice(label.length).trim();

      // Add the content (if any) from this line
      if (content) {
        const expectedContent = unescapeMarkdown(content);
        if (expectedResult.length > 0) {
          expectedResult += "\n" + expectedContent;
        } else {
          expectedResult = expectedContent;
        }
      }
      next += 1;
      continue;
    }

    // Check for lines that start with * and contain Expected (but don't match the above patterns)
    if (rawTrimmed.match(/^\*[^*]*expected/i)) {
      inExpectedResult = true;
      // Remove the leading * and trim
      let content = rawTrimmed.slice(1).trim();
      // Remove any "Expected:" prefix
      content = content.replace(/^expected\s*:?\s*/i, '').trim();

      const expectedContent = unescapeMarkdown(content);
      if (expectedResult.length > 0) {
        expectedResult += "\n" + expectedContent;
      } else {
        expectedResult = expectedContent;
      }
      next += 1;
      continue;
    }

    if (rawTrimmed.startsWith("```")) {
      if (inExpectedResult) {
        if (expectedResult.length > 0) {
          expectedResult += "\n" + unescapeMarkdown(rawTrimmed);
        } else {
          expectedResult = unescapeMarkdown(rawTrimmed);
        }
      } else {
        stepDataLines.push(unescapeMarkdown(rawTrimmed));
      }
      next += 1;
      while (next < lines.length) {
        const fenceLine = lines[next];
        const fenceTrimmed = fenceLine.trim();
        if (inExpectedResult) {
          expectedResult += "\n" + unescapeMarkdown(fenceTrimmed);
        } else {
          stepDataLines.push(unescapeMarkdown(fenceTrimmed));
        }
        next += 1;
        if (fenceTrimmed.startsWith("```")) {
          break;
        }
      }
      continue;
    }

    if (inExpectedResult) {
      // After finding the first expected result, indented lines are part of it
      if (hasIndent) {
        const expectedContent = unescapeMarkdown(rawTrimmed);
        if (expectedResult.length > 0) {
          expectedResult += "\n" + expectedContent;
        } else {
          expectedResult = expectedContent;
        }
      }
      next += 1;
      continue;
    }

    if (STEP_DATA_LINE_REGEX.test(rawTrimmed)) {
      const content = unescapeMarkdown(rawTrimmed);
      stepDataLines.push(content);
      next += 1;
      continue;
    }

    // If we have indent and the line doesn't match other patterns, treat it as step data
    if (hasIndent) {
      const content = unescapeMarkdown(rawTrimmed);
      stepDataLines.push(content);
      next += 1;
      continue;
    }

    break;
  }

  const stepData = stepDataLines
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  if (
    !isLikelyStep &&
    !expectedResult &&
    stepDataLines.length === 0 &&
    !(allowEmpty && titleWithPlaceholders.length > 0)
  ) {
    return null;
  }

  const stepDataWithImages = [stepData, titleImages.join("\n")]
    .filter(Boolean)
    .join(stepData ? "\n" : "");

  const blockProps =
    blockType === "snippet"
      ? {
          snippetId: snippetId ?? "",
          snippetTitle: titleWithPlaceholders,
          snippetData: stepDataWithImages,
          snippetExpectedResult: expectedResult,
        }
      : {
          stepTitle: titleWithPlaceholders,
          stepData: stepDataWithImages,
          expectedResult,
        };

  const parsedBlock: CustomPartialBlock = {
    type: blockType as any,
    props: blockProps as any,
    children: [],
  };

  return {
    block: parsedBlock,
    nextIndex: next,
  };
}

function parseHeading(lines: string[], index: number): { block: CustomPartialBlock; nextIndex: number } | null {
  const trimmed = lines[index].trim();
  if (!trimmed.startsWith("#")) {
    return null;
  }

  const match = trimmed.match(/^(#+)\s+(.*)$/);
  if (!match) {
    return null;
  }

  const rawLevel = Math.min(match[1].length, 3);
  const level = (rawLevel === 1 || rawLevel === 2 ? rawLevel : 3) as 1 | 2 | 3;
  const text = match[2];

  return {
    block: {
      type: "heading",
      props: { ...cloneBaseProps(), level },
      content: createTextContent(unescapeMarkdown(text)),
      children: [],
    },
    nextIndex: index + 1,
  };
}

function parseCodeBlock(lines: string[], index: number): { block: CustomPartialBlock; nextIndex: number } | null {
  const trimmed = lines[index].trim();
  if (!trimmed.startsWith("```") ) {
    return null;
  }

  const language = trimmed.slice(3).trim();
  const body: string[] = [];
  let next = index + 1;
  while (next < lines.length && !lines[next].startsWith("```") ) {
    body.push(lines[next]);
    next += 1;
  }

  if (next < lines.length && lines[next].startsWith("```")) {
    next += 1;
  }

  return {
    block: {
      type: "codeBlock",
      props: { language },
      content: body.length
        ? [{ type: "text", text: body.join("\n"), styles: {} }]
        : undefined,
      children: [],
    },
    nextIndex: next,
  };
}

function parseQuote(lines: string[], index: number): { block: CustomPartialBlock; nextIndex: number } | null {
  if (!lines[index].trim().startsWith(">")) {
    return null;
  }

  const collected: string[] = [];
  let next = index;
  while (next < lines.length) {
    const trimmed = lines[next].trim();
    if (!trimmed.startsWith(">")) {
      break;
    }
    collected.push(trimmed.replace(/^>\s?/, ""));
    next += 1;
  }

  return {
    block: {
      type: "quote",
      props: cloneBaseProps(),
      content: createTextContent(unescapeMarkdown(collected.join("\n"))),
      children: [],
    },
    nextIndex: next,
  };
}

function parseParagraph(lines: string[], index: number): { block: CustomPartialBlock; nextIndex: number } {
  const buffer: string[] = [];
  let next = index;

  const isTermination = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return true;
    }
    if (trimmed.startsWith(":::test-case")) {
      return true;
    }
    if (trimmed.startsWith("* ")) {
      return true;
    }
    if (trimmed.startsWith("#")) {
      return true;
    }
    if (trimmed.startsWith(">")) {
      return true;
    }
    if (trimmed.startsWith("```") ) {
      return true;
    }
    if (detectListType(trimmed)) {
      return true;
    }
    return false;
  };

  while (next < lines.length) {
    const line = lines[next];
    if (
      isTableRowLine(line) &&
      next + 1 < lines.length &&
      isSeparatorRow(lines[next + 1])
    ) {
      break;
    }
    if (isTermination(line) && buffer.length > 0) {
      break;
    }
    if (!line.trim()) {
      next += 1;
      break;
    }
    buffer.push(line.trim());
    next += 1;
  }

  return {
    block: {
      type: "paragraph",
      props: cloneBaseProps(),
      content: createTextContent(unescapeMarkdown(buffer.join(" "))),
      children: [],
    },
    nextIndex: next,
  };
}

function parseSnippetWrapper(
  lines: string[],
  index: number,
): { block: CustomPartialBlock; nextIndex: number } | null {
  const trimmed = lines[index].trim();
  const startMatch = trimmed.match(/^<!--\s*begin snippet\s*#?([^\s>]+)\s*-->/i);
  if (!startMatch) {
    return null;
  }

  const snippetId = startMatch[1];
  const innerLines: string[] = [];
  let next = index + 1;

  while (next < lines.length) {
    const maybeEnd = lines[next].trim();
    const endMatch = maybeEnd.match(/^<!--\s*end snippet\s*#?([^\s>]+)?\s*-->/i);
    if (endMatch) {
      const endId = endMatch[1];
      if (!endId || endId === snippetId) {
        next += 1;
        break;
      }
      // Ignore unrelated snippet end markers but keep scanning.
      next += 1;
      continue;
    }
    const otherStart = maybeEnd.match(/^<!--\s*begin snippet\s*#?([^\s>]+)\s*-->/i);
    if (otherStart) {
      // Skip nested snippet wrappers from the body entirely.
      next += 1;
      continue;
    }
    innerLines.push(lines[next]);
    next += 1;
  }

  const snippetBlock: CustomPartialBlock = {
    type: "snippet",
    props: {
      snippetId,
      snippetTitle: "",
      snippetData: innerLines.join("\n").trim(),
      snippetExpectedResult: "",
    },
    children: [],
  };

  return {
    block: snippetBlock,
    nextIndex: next,
  };
}

export function markdownToBlocks(markdown: string): CustomPartialBlock[] {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: CustomPartialBlock[] = [];
  let index = 0;
  let stepsHeadingLevel: number | null = null;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const snippetWrapper = parseSnippetWrapper(lines, index);
    if (snippetWrapper) {
      blocks.push(snippetWrapper.block);
      index = snippetWrapper.nextIndex;
      continue;
    }

    const stepLikeBlock = parseTestStep(lines, index, stepsHeadingLevel !== null);
    if (stepLikeBlock) {
      blocks.push(stepLikeBlock.block);
      index = stepLikeBlock.nextIndex;
      continue;
    }

    const table = parseTable(lines, index);
    if (table) {
      blocks.push(table.block);
      index = table.nextIndex;
      continue;
    }

    const heading = parseHeading(lines, index);
    if (heading) {
      const headingBlock = heading.block;
      const headingLevel = (headingBlock.props as any)?.level ?? 3;
      const headingText = inlineContentToPlainText(headingBlock.content as any);
      const normalizedHeading = headingText.trim().toLowerCase();

      if (normalizedHeading === "steps") {
        stepsHeadingLevel = headingLevel;
      } else if (
        stepsHeadingLevel !== null &&
        headingLevel <= stepsHeadingLevel &&
        normalizedHeading.length > 0
      ) {
        stepsHeadingLevel = null;
      }

      blocks.push(headingBlock);
      index = heading.nextIndex;
      continue;
    }

    const code = parseCodeBlock(lines, index);
    if (code) {
      blocks.push(code.block);
      index = code.nextIndex;
      continue;
    }

    const quote = parseQuote(lines, index);
    if (quote) {
      blocks.push(quote.block);
      index = quote.nextIndex;
      continue;
    }

    const listType = detectListType(line.trim());
    if (listType) {
      const { items, nextIndex } = parseList(
        lines,
        index,
        listType,
        0,
        stepsHeadingLevel !== null,
      );
      blocks.push(...items);
      index = nextIndex;
      continue;
    }

    const paragraph = parseParagraph(lines, index);
    blocks.push(paragraph.block);
    index = paragraph.nextIndex;
  }

  return blocks;
}

function splitTableRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith("|")) {
    value = value.slice(1);
  }
  if (value.endsWith("|")) {
    value = value.slice(0, -1);
  }

  const cells: string[] = [];
  let current = "";
  let i = 0;
  while (i < value.length) {
    const char = value[i];
    if (char === "\\" && i + 1 < value.length) {
      current += value[i + 1];
      i += 2;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      i += 1;
      continue;
    }
    current += char;
    i += 1;
  }
  cells.push(current.trim());
  return cells;
}

function isTableRowLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return false;
  }
  const cells = splitTableRow(trimmed);
  return cells.length >= 2;
}

function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return false;
  }
  const cells = splitTableRow(trimmed);
  if (!cells.length) {
    return false;
  }
  return cells.every((cell) => /^:?[-]{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function alignmentFromToken(token: string): "left" | "center" | "right" | "justify" {
  const trimmed = token.trim();
  if (trimmed.startsWith(":") && trimmed.endsWith(":")) {
    return "center";
  }
  if (trimmed.endsWith(":")) {
    return "right";
  }
  if (trimmed.startsWith(":")) {
    return "left";
  }
  return "left";
}

function parseTable(lines: string[], index: number): { block: CustomPartialBlock; nextIndex: number } | null {
  if (!isTableRowLine(lines[index])) {
    return null;
  }

  if (index + 1 >= lines.length || !isSeparatorRow(lines[index + 1])) {
    return null;
  }

  const headerCells = splitTableRow(lines[index]);
  const alignmentCells = splitTableRow(lines[index + 1]);

  const columnCount = Math.max(headerCells.length, alignmentCells.length);
  const columnAlignments: Array<"left" | "center" | "right" | "justify"> =
    new Array(columnCount).fill("left");
  alignmentCells.forEach((token, idx) => {
    columnAlignments[idx] = alignmentFromToken(token);
  });

  const allRows: string[][] = [headerCells];
  let next = index + 2;
  while (next < lines.length && isTableRowLine(lines[next])) {
    allRows.push(splitTableRow(lines[next]));
    next += 1;
  }

  const normalizedRows = allRows.map((row) => {
    const cells = [...row];
    while (cells.length < columnCount) {
      cells.push("");
    }
    return cells;
  });

  const tableRows = normalizedRows.map((row) => {
    const cells = row.map((cellText, columnIndex) => ({
      type: "tableCell" as const,
      props: {
        ...cloneCellProps(),
        textAlignment: columnAlignments[columnIndex] ?? "left",
      },
      content: createTextContent(cellText) ?? [],
    }));
    return { cells };
  }) as Array<{ cells: any[] }>;

  const tableBlock: CustomPartialBlock = {
    type: "table",
    props: { ...TABLE_BLOCK_PROPS },
    content: {
      type: "tableContent",
      columnWidths: new Array(columnCount).fill(undefined),
      headerRows: 1,
      rows: tableRows,
    },
    children: [],
  };

  return {
    block: tableBlock,
    nextIndex: next,
  };
}

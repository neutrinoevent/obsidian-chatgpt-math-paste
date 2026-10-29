import { applyMathJaxCompatibility } from "./tex-compat";
import { transformMathRegions } from "./markdown-math";

export type HtmlToMarkdown = (html: HTMLElement) => string;

export interface ConversionOptions {
  /**
   * Rewrite commands Obsidian's MathJax cannot render. Extracted TeX is
   * faithful to the source, which is not the same as renderable here.
   */
  mathJaxCompatibility?: boolean;
}

interface ExtractedMath {
  token: string;
  tex: string;
  display: boolean;
}

const TEX_ANNOTATION_SELECTOR = [
  'annotation[encoding="application/x-tex"]',
  'annotation[encoding="application/x-latex"]',
].join(",");

/**
 * Converts rich HTML containing KaTeX/MathML into Obsidian Markdown.
 *
 * KaTeX puts an accessible MathML rendering, the original TeX annotation,
 * and a visual HTML rendering inside the same wrapper. Replacing the entire
 * wrapper is what prevents the duplicated Unicode + TeX seen in plain-text
 * pastes.
 */
export function convertMathHtmlToMarkdown(
  html: string,
  toMarkdown: HtmlToMarkdown,
  options: ConversionOptions = {},
): string | null {
  const { mathJaxCompatibility = true } = options;

  if (!html.trim()) return null;

  const document = new DOMParser().parseFromString(html, "text/html");
  const annotations = Array.from(
    document.body.querySelectorAll<HTMLElement>(TEX_ANNOTATION_SELECTOR),
  );

  const extracted: ExtractedMath[] = [];

  for (const annotation of annotations) {
    // A display wrapper can contain the annotation we already removed.
    if (!document.body.contains(annotation)) continue;

    const original = annotation.textContent?.trim();
    if (!original) continue;

    const tex = mathJaxCompatibility
      ? applyMathJaxCompatibility(original)
      : original;

    const mathElement = annotation.closest("math");
    const katexElement = annotation.closest(".katex");
    const displayElement = katexElement?.closest(".katex-display");
    const display =
      displayElement !== null && displayElement !== undefined
        ? true
        : mathElement?.getAttribute("display") === "block";
    const target = displayElement ?? katexElement ?? mathElement ?? annotation;
    const token = `OBSIDIANCHATGPTMATHTOKEN${extracted.length}END`;

    extracted.push({ token, tex, display });
    target.replaceWith(document.createTextNode(token));
  }

  let markdown = toMarkdown(document.body);

  for (const math of extracted) {
    const replacement = math.display
      ? `\n\n$$\n${math.tex}\n$$\n\n`
      : `$${math.tex}$`;
    markdown = markdown.split(math.token).join(replacement);
  }

  const repaired = repairSerializedMathMarkdown(
    markdown,
    mathJaxCompatibility,
  );

  // With no TeX annotations, only take over the paste when Obsidian's HTML
  // serializer produced a recognized Markdown math form that we repaired.
  // This keeps ordinary rich clipboard content under Obsidian's normal paste
  // behavior while supporting ChatGPT clipboard HTML that now carries TeX as
  // escaped Markdown text instead of MathML annotations.
  if (extracted.length === 0 && repaired === markdown) return null;

  return tidyMarkdown(repaired);
}

/** Convert ChatGPT's LaTeX delimiters to the dollar delimiters Obsidian uses. */
export function normalizeMathDelimiters(markdown: string): string {
  markdown = normalizeEscapedDollarMath(markdown);

  const lines = markdown.split("\n");
  let fence: { character: "`" | "~"; length: number } | null = null;
  let inlineTicks = 0;

  return lines
    .map((line) => {
      const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fenceMatch) {
        const marker = fenceMatch[1];
        const character = marker[0] as "`" | "~";
        if (!fence) {
          fence = { character, length: marker.length };
        } else if (
          fence.character === character &&
          marker.length >= fence.length
        ) {
          fence = null;
        }
        return line;
      }

      if (fence) return line;

      let output = "";
      for (let index = 0; index < line.length; ) {
        if (line[index] === "`") {
          let end = index;
          while (line[end] === "`") end += 1;
          const runLength = end - index;
          if (inlineTicks === 0) inlineTicks = runLength;
          else if (inlineTicks === runLength) inlineTicks = 0;
          output += line.slice(index, end);
          index = end;
          continue;
        }

        if (inlineTicks === 0 && line[index] === "\\") {
          const next = line[index + 1];
          if (next === "(" || next === ")") {
            output += "$";
            index += 2;
            continue;
          }
          if (next === "[") {
            output += "$$";
            index += 2;
            continue;
          }
          if (next === "]") {
            output += "$$";
            index += 2;
            continue;
          }
        }

        output += line[index];
        index += 1;
      }
      return output;
    })
    .join("\n");
}

/**
 * Repairs math that an HTML-to-Markdown serializer escaped as literal
 * Markdown: `\$x\_1\$` or `\$$x\_1\$$`.
 *
 * The delimiters must be paired, inline regions must be unpadded and remain on
 * one line, and code spans and fenced blocks are excluded. Those constraints
 * prevent a lone escaped currency sign or code example from turning into
 * math. Markdown's escape for `_` is removed only inside a confirmed region;
 * a global unescape would corrupt prose, URLs, and intentional TeX escapes.
 */
function normalizeEscapedDollarMath(markdown: string): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let fence: { character: "`" | "~"; length: number } | null = null;
  let pending: string[] = [];

  const flush = (): void => {
    if (pending.length === 0) return;
    output.push(normalizeEscapedDollarBlock(pending.join("\n")));
    pending = [];
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      const character = marker[0] as "`" | "~";

      if (!fence) {
        flush();
        fence = { character, length: marker.length };
      } else if (fence.character === character && marker.length >= fence.length) {
        fence = null;
      }

      output.push(line);
      continue;
    }

    if (fence) output.push(line);
    else pending.push(line);
  }

  flush();
  return output.join("\n");
}

function normalizeEscapedDollarBlock(text: string): string {
  let output = "";
  let index = 0;
  let inlineTicks = 0;

  while (index < text.length) {
    if (text[index] === "`") {
      let end = index;
      while (text[end] === "`") end += 1;
      const runLength = end - index;

      if (inlineTicks === 0) inlineTicks = runLength;
      else if (inlineTicks === runLength) inlineTicks = 0;

      output += text.slice(index, end);
      index = end;
      continue;
    }

    if (
      inlineTicks === 0 &&
      text[index] === "\\" &&
      text[index + 1] === "$"
    ) {
      const display = text[index + 2] === "$";
      const openingLength = display ? 3 : 2;
      const close = findEscapedDollarClose(
        text,
        index + openingLength,
        display,
      );

      if (close !== -1) {
        const tex = text.slice(index + openingLength, close);
        const valid = display
          ? tex.trim().length > 0 && !tex.includes("`")
          : tex.length > 0 &&
            !tex.includes("\n") &&
            !tex.includes("`") &&
            !/^\s|\s$/.test(tex);

        if (valid) {
          const delimiter = display ? "$$" : "$";
          output += delimiter + unescapeSerializedMath(tex) + delimiter;
          index = close + openingLength;
          continue;
        }

        // This pair is not math. Preserve everything before the candidate
        // closer and reconsider that closer as a possible opener. Advancing
        // directly keeps a clipboard containing many escaped dollars linear
        // rather than repeatedly scanning the same suffix.
        output += text.slice(index, close);
        index = close;
        continue;
      }
    }

    output += text[index];
    index += 1;
  }

  return output;
}

function findEscapedDollarClose(
  text: string,
  from: number,
  display: boolean,
): number {
  let inlineTicks = 0;

  for (let index = from; index < text.length; index += 1) {
    if (!display && text[index] === "\n") return -1;

    if (text[index] === "`") {
      let end = index;
      while (text[end] === "`") end += 1;
      const runLength = end - index;

      if (inlineTicks === 0) inlineTicks = runLength;
      else if (inlineTicks === runLength) inlineTicks = 0;

      index = end - 1;
      continue;
    }

    if (inlineTicks > 0) continue;
    if (text[index] !== "\\") continue;

    // A doubled backslash protects the following character from being read as
    // one of the serializer's escaped delimiters.
    if (text[index + 1] === "\\") {
      index += 1;
      continue;
    }

    if (text[index + 1] !== "$") continue;

    if (display) {
      if (text[index + 2] === "$") return index;
    } else if (text[index + 2] !== "$") {
      return index;
    }
  }

  return -1;
}

function unescapeSerializedMath(tex: string): string {
  let output = "";

  for (let index = 0; index < tex.length; ) {
    if (tex[index] !== "\\") {
      output += tex[index];
      index += 1;
      continue;
    }

    let end = index;
    while (tex[end] === "\\") end += 1;
    const runLength = end - index;

    if (tex[end] === "_" && runLength % 2 === 1) {
      // An odd run leaves one serializer-added escape immediately before the
      // underscore. Remove that one while preserving any TeX `\\` pairs.
      output += "\\".repeat(runLength - 1) + "_";
      index = end + 1;
    } else {
      output += tex.slice(index, end);
      index = end;
    }
  }

  return output;
}

function repairSerializedMathMarkdown(
  markdown: string,
  mathJaxCompatibility: boolean,
): string {
  const normalized = normalizeMathDelimiters(markdown);
  if (!mathJaxCompatibility) return normalized;

  return transformMathRegions(normalized, applyMathJaxCompatibility);
}

function tidyMarkdown(markdown: string): string {
  return markdown
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

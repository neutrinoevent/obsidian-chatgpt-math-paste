import { applyMathJaxCompatibility } from "./tex-compat";

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

  if (annotations.length === 0) return null;

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

  if (extracted.length === 0) return null;

  let markdown = toMarkdown(document.body);

  for (const math of extracted) {
    const replacement = math.display
      ? `\n\n$$\n${math.tex}\n$$\n\n`
      : `$${math.tex}$`;
    markdown = markdown.split(math.token).join(replacement);
  }

  return tidyMarkdown(markdown);
}

/** Convert ChatGPT's LaTeX delimiters to the dollar delimiters Obsidian uses. */
export function normalizeMathDelimiters(markdown: string): string {
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

function tidyMarkdown(markdown: string): string {
  return markdown
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

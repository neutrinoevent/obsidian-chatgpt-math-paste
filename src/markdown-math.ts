/**
 * Locating math inside Markdown.
 *
 * The rich clipboard path knows exactly where math is, because it reads it
 * from a MathML annotation. A note that has already been pasted does not carry
 * that structure any more: its math is delimited by dollars and surrounded by
 * ordinary prose, code spans, and fenced blocks.
 *
 * This module finds those regions so a compatibility rewrite can be applied to
 * an existing note without touching prose or code.
 */

type Transform = (tex: string) => string;

/**
 * Applies a transform to the TeX inside `$...$` and `$$...$$` regions.
 *
 * Fenced blocks, inline code spans, and escaped dollars are left alone.
 * Everything outside a math region is returned byte for byte.
 */
export function transformMathRegions(
  markdown: string,
  transform: Transform,
): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let fence: { character: "`" | "~"; length: number } | null = null;
  let pending: string[] = [];

  const flush = (): void => {
    if (pending.length === 0) return;
    output.push(transformBlock(pending.join("\n"), transform));
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

    if (fence) {
      output.push(line);
      continue;
    }

    pending.push(line);
  }

  flush();

  return output.join("\n");
}

/** Returns the TeX of every math region in a Markdown document. */
export function collectMathRegions(markdown: string): string[] {
  const regions: string[] = [];

  transformMathRegions(markdown, (tex) => {
    regions.push(tex);
    return tex;
  });

  return regions;
}

/**
 * Scans a run of non-fenced lines, transforming math regions.
 *
 * A block is scanned as one string rather than line by line, because display
 * math spans lines while inline math does not.
 */
function transformBlock(text: string, transform: Transform): string {
  let output = "";
  let index = 0;
  let inlineTicks = 0;

  while (index < text.length) {
    const character = text[index];

    // An escaped character, most importantly \$, is never a delimiter.
    if (character === "\\" && index + 1 < text.length) {
      output += text.slice(index, index + 2);
      index += 2;
      continue;
    }

    if (character === "`") {
      let end = index;
      while (text[end] === "`") end += 1;
      const runLength = end - index;

      if (inlineTicks === 0) inlineTicks = runLength;
      else if (inlineTicks === runLength) inlineTicks = 0;

      output += text.slice(index, end);
      index = end;
      continue;
    }

    if (inlineTicks > 0 || character !== "$") {
      output += character;
      index += 1;
      continue;
    }

    const display = text[index + 1] === "$";
    const region = display
      ? readDisplayRegion(text, index)
      : readInlineRegion(text, index);

    if (!region) {
      output += character;
      index += 1;
      continue;
    }

    const delimiter = display ? "$$" : "$";
    output += delimiter + transform(region.tex) + delimiter;
    index = region.end;
  }

  return output;
}

interface Region {
  tex: string;
  /** Index just past the closing delimiter. */
  end: number;
}

function readDisplayRegion(text: string, start: number): Region | null {
  const close = indexOfUnescaped(text, "$$", start + 2);
  if (close === -1) return null;

  return { tex: text.slice(start + 2, close), end: close + 2 };
}

/**
 * Reads an inline region, applying the constraints that keep ordinary prose
 * from being mistaken for math: a single line, no padding whitespace, and a
 * non-empty body. This is what stops "$5 and $10" from being read as an
 * expression.
 */
function readInlineRegion(text: string, start: number): Region | null {
  const close = indexOfUnescaped(text, "$", start + 1);
  if (close === -1 || close === start + 1) return null;

  const tex = text.slice(start + 1, close);
  if (tex.includes("\n")) return null;
  if (/^\s|\s$/.test(tex)) return null;

  return { tex, end: close + 1 };
}

function indexOfUnescaped(
  text: string,
  needle: string,
  from: number,
): number {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] === "\\") {
      index += 1;
      continue;
    }
    if (text.startsWith(needle, index)) return index;
  }

  return -1;
}

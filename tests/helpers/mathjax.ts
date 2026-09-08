/**
 * Renders TeX with MathJax and reports the geometry of the result.
 *
 * Obsidian renders math with MathJax, so a replacement that parses is not
 * necessarily a replacement that renders correctly. This harness makes the two
 * failures that actually occurred in the field observable in a test:
 *
 * 1. an undefined command, which MathJax marks with `data-mjx-error`; and
 * 2. ink drawn outside its own box, which paints over neighbouring text.
 */
import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// `noundefined` is deliberately excluded. It is what makes Obsidian draw an
// unknown command as red text rather than failing, which is exactly the
// silent failure this project exists to prevent. Dropping it turns "MathJax
// does not know this command" into a hard, checkable error instead.
const PACKAGES = AllPackages.filter((name) => name !== "noundefined");

const document_ = mathjax.document("", {
  InputJax: new TeX({ packages: PACKAGES }),
  OutputJax: new SVG({ fontCache: "none" }),
});

/** Advance widths in font units for the glyphs the constructions use. */
const ADVANCE: Record<string, { text: number; display: number }> = {
  "222B": { text: 610, display: 944 }, // integral sign
  "25EF": { text: 1000, display: 1000 }, // large circle
};

/** MathJax reports the width attribute in ex; this converts to font units. */
const EX_TO_UNITS = 500 / 1.131;

export interface Geometry {
  /** MathJax's error message, or null when the expression rendered. */
  error: string | null;
  /** Advance width of the expression, in font units. */
  box: number;
  /** Leftmost and rightmost ink, in font units. */
  ink: [number, number] | null;
  /** Circle centre minus integral centre. Zero is perfectly centred. */
  offCentre: number | null;
}

interface Glyph {
  char: string;
  x: number;
  scale: number;
}

/**
 * Renders an expression, or reports why it could not be rendered.
 *
 * Without `noundefined`, MathJax throws on an unknown command rather than
 * drawing it in red, so a throw is a result rather than a crash.
 */
function render(
  tex: string,
  display: boolean,
): { node: unknown; error: string | null } {
  try {
    return {
      node: document_.convert(tex, {
        display,
        em: 16,
        ex: 8,
        containerWidth: 1280,
      }),
      error: null,
    };
  } catch (thrown) {
    return { node: null, error: (thrown as Error).message ?? String(thrown) };
  }
}

function collectGlyphs(node: unknown): { glyphs: Glyph[]; error: string | null } {
  const glyphs: Glyph[] = [];
  let error: string | null = null;

  const walk = (current: unknown, x: number, scale: number): void => {
    if (current === null || current === undefined) return;
    const kind = adaptor.kind(current as never);
    if (["g", "use", "path", "rect", "svg"].includes(kind)) {
      const transform = adaptor.getAttribute(current as never, "transform") || "";
      const translate = transform.match(/translate\(\s*([-\d.]+)/);
      if (translate) x += Number(translate[1]) * scale;
      // Script styles are applied as a scale(), which glyph widths follow.
      const scaled = transform.match(/scale\(\s*([-\d.]+)/);
      if (scaled && Number(scaled[1]) > 0) scale *= Number(scaled[1]);

      const char = adaptor.getAttribute(current as never, "data-c");
      if (char) glyphs.push({ char: char.toUpperCase(), x, scale });

      const failed = adaptor.getAttribute(current as never, "data-mjx-error");
      if (failed) error = failed;
    }
    // Text and comment nodes have no child list; MathJax emits them only in
    // its error output, so recursing blindly crashes on exactly the case the
    // tests care most about.
    if (kind === "#text" || kind === "#comment") return;
    for (const child of adaptor.childNodes(current as never) || []) {
      walk(child, x, scale);
    }
  };

  walk(node, 0, 1);
  return { glyphs, error };
}

export function geometry(tex: string, display: boolean): Geometry {
  const rendered = render(tex, display);
  if (rendered.node === null) {
    return { error: rendered.error, box: Number.NaN, ink: null, offCentre: null };
  }

  const node = rendered.node;
  const { glyphs, error } = collectGlyphs(node);

  const widthMatch = adaptor.outerHTML(node as never).match(/width="([\d.]+)ex"/);
  const box = widthMatch ? Number(widthMatch[1]) * EX_TO_UNITS : Number.NaN;

  const style = display ? "display" : "text";
  const width = (glyph: Glyph): number =>
    (ADVANCE[glyph.char]?.[style] ?? 0) * glyph.scale;

  const integrals = glyphs.filter((glyph) => glyph.char === "222B");
  const circles = glyphs.filter((glyph) => glyph.char === "25EF");

  if (integrals.length === 0 || circles.length === 0) {
    return { error, box, ink: null, offCentre: null };
  }

  const last = integrals.reduce((a, b) => (b.x > a.x ? b : a));
  const integralLeft = Math.min(...integrals.map((glyph) => glyph.x));
  const integralRight = last.x + width(last);
  const circleLeft = circles[0].x;
  const circleRight = circleLeft + width(circles[0]);

  return {
    error,
    box,
    ink: [Math.min(integralLeft, circleLeft), Math.max(integralRight, circleRight)],
    offCentre:
      (circleLeft + circleRight) / 2 - (integralLeft + integralRight) / 2,
  };
}

/** True when the expression renders without a MathJax error. */
export function renders(tex: string, display: boolean): boolean {
  const rendered = render(tex, display);
  if (rendered.node === null) return false;
  return collectGlyphs(rendered.node).error === null;
}

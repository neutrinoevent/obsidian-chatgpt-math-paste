/**
 * Rendering tests.
 *
 * The other suites check that the converter produces the strings it intends
 * to. These check that Obsidian's renderer can actually draw them, which is a
 * different question and the one that caused every field failure so far.
 */
import { describe, expect, it } from "vitest";
import { geometry, renders } from "./helpers/mathjax";
import { MATHJAX_REPLACEMENTS } from "../src/tex-compat";

const STYLES: [string, boolean][] = [
  ["text", false],
  ["display", true],
];

describe("every replacement renders in MathJax", () => {
  // A replacement built from a command MathJax lacks would fail exactly the
  // way the original bug did, and silently.
  for (const [name, replacement] of Object.entries(MATHJAX_REPLACEMENTS)) {
    for (const [styleName, display] of STYLES) {
      it(`\\${name} renders in ${styleName} style`, () => {
        expect(renders(replacement, display)).toBe(true);
      });
    }
  }
});

describe("closed integrals are drawn inside their own box", () => {
  // The reported defect: the circle was drawn to the left of the operator's
  // box and painted over the preceding character. Ink outside the box is the
  // machine-checkable form of that bug.
  for (const name of ["oiint", "oiiint"]) {
    for (const [styleName, display] of STYLES) {
      it(`\\${name} keeps its ink within its box in ${styleName} style`, () => {
        const { error, box, ink } = geometry(
          MATHJAX_REPLACEMENTS[name],
          display,
        );

        expect(error).toBeNull();
        expect(ink).not.toBeNull();
        const [left, right] = ink as [number, number];

        expect(left).toBeGreaterThanOrEqual(-1);
        expect(right).toBeLessThanOrEqual(box + 1);
      });

      it(`\\${name} centres its circle in ${styleName} style`, () => {
        const { offCentre } = geometry(MATHJAX_REPLACEMENTS[name], display);
        expect(Math.abs(offCentre as number)).toBeLessThanOrEqual(2);
      });
    }
  }
});

describe("the originally reported equation", () => {
  const equation = (closed: string): string =>
    `\\iiint_V (\\nabla \\cdot \\mathbf{F})\\, dV = ${closed}_{\\partial V} \\mathbf{F} \\cdot d\\mathbf{A}`;

  it("renders with the replacement in place", () => {
    expect(renders(equation(MATHJAX_REPLACEMENTS.oiint), true)).toBe(true);
  });

  it("does not render with the original KaTeX command", () => {
    // Guards the premise of the whole compatibility layer. If this ever
    // starts passing, Obsidian gained \oiint and the entry can be dropped.
    expect(renders(equation("\\oiint"), true)).toBe(false);
  });
});

describe("the superseded construction is genuinely broken", () => {
  // Kept as a regression guard: this is what shipped in 1.2.0, and the test
  // must be able to tell it apart from the fix.
  const broken = "\\mathop{{\\int\\!\\!\\!\\!\\int}\\mkern-21mu\\bigcirc}\\nolimits";

  it("draws ink to the left of its box in text style", () => {
    const { ink } = geometry(broken, false);
    expect((ink as [number, number])[0]).toBeLessThan(-100);
  });
});

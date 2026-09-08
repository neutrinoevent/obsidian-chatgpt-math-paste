import { describe, expect, it } from "vitest";
import {
  applyMathJaxCompatibility,
  findUnsupportedCommands,
  MATHJAX_REPLACEMENTS,
} from "../src/tex-compat";

describe("applyMathJaxCompatibility", () => {
  it("rewrites the closed surface integral that MathJax cannot render", () => {
    const tex =
      "\\iiint_V (\\nabla \\cdot \\mathbf{F})\\, dV = \\oiint_{\\partial V} \\mathbf{F} \\cdot d\\mathbf{A}";

    const converted = applyMathJaxCompatibility(tex);

    expect(converted).not.toContain("\\oiint");
    expect(converted).toContain("\\bigcirc");
    // The subscript must still attach to the operator.
    expect(converted).toContain("\\nolimits_{\\partial V}");
    // Nothing else in the expression may be disturbed.
    expect(converted).toContain("\\iiint_V");
    expect(converted).toContain("\\mathbf{F} \\cdot d\\mathbf{A}");
  });

  it("leaves TeX that already renders untouched", () => {
    const tex = "\\int_0^1 x^2\\, dx = \\frac{1}{3}";
    expect(applyMathJaxCompatibility(tex)).toBe(tex);
  });

  it("matches control words whole", () => {
    // \rarr is rewritten; \rarrow is an unrelated name that must survive.
    expect(applyMathJaxCompatibility("\\rarr")).toBe("\\rightarrow");
    expect(applyMathJaxCompatibility("\\rarrow")).toBe("\\rarrow");
  });

  it("steps over escaped characters rather than reading them as commands", () => {
    expect(applyMathJaxCompatibility("a \\\\ \\rarr b")).toBe(
      "a \\\\ \\rightarrow b",
    );
    expect(applyMathJaxCompatibility("\\$ \\rarr")).toBe("\\$ \\rightarrow");
  });

  it("consumes the whitespace that terminated the control word", () => {
    expect(applyMathJaxCompatibility("x \\rarr y")).toBe("x \\rightarrow y");
    expect(applyMathJaxCompatibility("\\degree C")).toBe("{}^\\circ C");
  });

  it("respects a definition the expression provides for itself", () => {
    const tex = "\\newcommand{\\degree}{^{\\circ}} 90\\degree";
    expect(applyMathJaxCompatibility(tex)).toBe(tex);

    const defTex = "\\def\\rarr{\\to} \\rarr";
    expect(applyMathJaxCompatibility(defTex)).toBe(defTex);
  });

  it("builds every replacement from commands MathJax defines", () => {
    // A replacement that itself needed rewriting would be a silent regression.
    for (const replacement of Object.values(MATHJAX_REPLACEMENTS)) {
      expect(applyMathJaxCompatibility(replacement)).toBe(replacement);
    }
  });
});

describe("findUnsupportedCommands", () => {
  it("names commands that cannot be repaired automatically", () => {
    expect(findUnsupportedCommands("\\href{a}{b} + \\utilde{x}")).toEqual([
      "href",
      "utilde",
    ]);
  });

  it("reports nothing for TeX it can render or repair", () => {
    expect(findUnsupportedCommands("\\oiint_{\\partial V} x")).toEqual([]);
    expect(findUnsupportedCommands("\\frac{1}{2}")).toEqual([]);
  });
});

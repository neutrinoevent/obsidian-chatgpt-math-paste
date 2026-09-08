import { describe, expect, it } from "vitest";
import {
  collectMathRegions,
  transformMathRegions,
} from "../src/markdown-math";
import { applyMathJaxCompatibility } from "../src/tex-compat";

const repair = (markdown: string): string =>
  transformMathRegions(markdown, applyMathJaxCompatibility);

describe("transformMathRegions", () => {
  it("repairs display math in an already-pasted note", () => {
    const note = [
      "Absolutely. The divergence theorem,",
      "",
      "$$",
      "\\iiint_V (\\nabla \\cdot \\mathbf{F})\\, dV = \\oiint_{\\partial V} \\mathbf{F} \\cdot d\\mathbf{A}",
      "$$",
      "",
      "is enormously robust.",
    ].join("\n");

    const repaired = repair(note);

    expect(repaired).not.toContain("\\oiint");
    expect(repaired).toContain("\\bigcirc");
    expect(repaired).toContain("Absolutely. The divergence theorem,");
    expect(repaired).toContain("is enormously robust.");
  });

  it("repairs inline math", () => {
    expect(repair("Let $x \\rarr y$ hold.")).toBe(
      "Let $x \\rightarrow y$ hold.",
    );
  });

  it("leaves prose, code spans, and fenced blocks alone", () => {
    const note = [
      "Prose mentioning \\oiint outside math.",
      "`$\\oiint$`",
      "```tex",
      "$\\oiint_{\\partial V}$",
      "```",
    ].join("\n");

    expect(repair(note)).toBe(note);
  });

  it("does not mistake currency for math", () => {
    const note = "It cost $5 and then $10 more.";
    expect(repair(note)).toBe(note);
    expect(collectMathRegions(note)).toEqual([]);
  });

  it("ignores escaped dollars", () => {
    const note = "A \\$literal\\$ amount with \\oiint nearby.";
    expect(repair(note)).toBe(note);
  });

  it("returns text outside math byte for byte", () => {
    const note = [
      "# Heading",
      "",
      "- item with $a+b$",
      "- item with `code`",
      "",
      "> quote",
    ].join("\n");

    expect(repair(note)).toBe(note);
  });
});

describe("collectMathRegions", () => {
  it("finds inline and display regions", () => {
    const note = ["Take $a+b$ then", "", "$$", "c = d", "$$"].join("\n");

    expect(collectMathRegions(note)).toEqual(["a+b", "\nc = d\n"]);
  });
});

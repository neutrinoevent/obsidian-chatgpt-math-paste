// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  convertMathHtmlToMarkdown,
  normalizeMathDelimiters,
} from "../src/converter";

function textOnly(element: HTMLElement): string {
  return element.textContent ?? "";
}

describe("convertMathHtmlToMarkdown", () => {
  it("removes the duplicated visual rendering and keeps inline TeX", () => {
    const html = `
      <p>Take
        <span class="katex">
          <span class="katex-mathml">
            <math><semantics><mrow>∣ψ⟩</mrow><annotation encoding="application/x-tex">|\\psi\\rangle</annotation></semantics></math>
          </span>
          <span class="katex-html" aria-hidden="true">∣ψ⟩</span>
        </span>
        as the state.
      </p>`;

    expect(convertMathHtmlToMarkdown(html, textOnly)).toBe(
      "Take\n        $|\\psi\\rangle$\n        as the state.",
    );
  });

  it("uses a block delimiter for display math", () => {
    const html = `
      <p>Before</p>
      <div class="katex-display"><span class="katex"><math display="block"><semantics>
        <mrow>E=mc²</mrow>
        <annotation encoding="application/x-tex">E=mc^2</annotation>
      </semantics></math><span aria-hidden="true">E=mc²</span></span></div>
      <p>After</p>`;

    const converted = convertMathHtmlToMarkdown(html, textOnly);
    expect(converted).toContain("$$\nE=mc^2\n$$");
    expect(converted).not.toContain("E=mc²");
  });

  it("rewrites math the source renders but Obsidian cannot", () => {
    // Regression: KaTeX defines \oiint, MathJax does not. The TeX arrived
    // intact and then failed at render time as red text in an error box.
    const html = `
      <div class="katex-display"><span class="katex"><math display="block"><semantics>
        <mrow>∭</mrow>
        <annotation encoding="application/x-tex">\\iiint_V (\\nabla \\cdot \\mathbf{F})\\, dV = \\oiint_{\\partial V} \\mathbf{F} \\cdot d\\mathbf{A}</annotation>
      </semantics></math></span></div>`;

    const converted = convertMathHtmlToMarkdown(html, textOnly);

    expect(converted).not.toContain("\\oiint");
    expect(converted).toContain("\\bigcirc");
    expect(converted).toContain("\\nolimits_{\\partial V}");
    expect(converted).toContain("\\iiint_V");
  });

  it("can be asked to keep the source TeX verbatim", () => {
    const html = `
      <span class="katex"><math><semantics><mrow>∯</mrow>
      <annotation encoding="application/x-tex">\\oiint</annotation>
      </semantics></math></span>`;

    expect(
      convertMathHtmlToMarkdown(html, textOnly, { mathJaxCompatibility: false }),
    ).toBe("$\\oiint$");
  });

  it("leaves unrelated HTML to Obsidian's normal paste behavior", () => {
    expect(convertMathHtmlToMarkdown("<p>No math</p>", textOnly)).toBeNull();
  });
});

describe("normalizeMathDelimiters", () => {
  it("normalizes inline and display delimiters", () => {
    expect(normalizeMathDelimiters("A \\(x+1\\) and \\[y=2\\]")).toBe(
      "A $x+1$ and $$y=2$$",
    );
  });

  it("does not alter fenced or inline code", () => {
    const markdown = [
      "Outside \\(x\\)",
      "`inside \\(y\\)`",
      "```text",
      "inside \\(z\\)",
      "```",
    ].join("\n");
    const expected = [
      "Outside $x$",
      "`inside \\(y\\)`",
      "```text",
      "inside \\(z\\)",
      "```",
    ].join("\n");

    expect(normalizeMathDelimiters(markdown)).toBe(expected);
  });
});

/**
 * Compatibility between the TeX dialect ChatGPT emits and the one Obsidian
 * renders.
 *
 * ChatGPT renders math with KaTeX. Obsidian renders it with MathJax. KaTeX
 * defines commands that MathJax's default packages do not, so extracting the
 * original TeX faithfully is necessary but not sufficient. A command such as
 * `\oiint` survives the paste intact and then fails at render time, appearing
 * as red literal text inside a MathJax error box.
 *
 * Every replacement below is built only from commands MathJax defines by
 * default, so a converted note renders in a stock vault with no plugin,
 * preamble, or macro dependency.
 *
 * Adding an entry is the intended way to fix a report of this kind. Commands
 * that cannot be expressed as a single token substitution are listed in
 * UNSUPPORTED_COMMANDS instead, so the diagnostic can name them rather than
 * rewriting them incorrectly.
 */

/** Commands MathJax does not define, mapped to equivalents that it does. */
export const MATHJAX_REPLACEMENTS: Readonly<Record<string, string>> = {
  // --- Closed integrals -------------------------------------------------
  // These belong to `esint`, which Obsidian does not load, so they are
  // composed from base commands. The trailing \nolimits reproduces the limit
  // placement of an integral; \mathop would otherwise centre limits above and
  // below in display style.
  oiint: "\\mathop{{\\int\\!\\!\\!\\!\\int}\\mkern-21mu\\bigcirc}\\nolimits",
  oiiint:
    "\\mathop{{\\int\\!\\!\\!\\!\\int\\!\\!\\!\\!\\int}\\mkern-31mu\\bigcirc}\\nolimits",

  // --- Colon relations from `mathtools` ---------------------------------
  // \mathrel keeps relation spacing around the pair while suppressing it
  // between the two symbols.
  coloneqq: "\\mathrel{:=}",
  Coloneqq: "\\mathrel{::=}",
  coloneq: "\\mathrel{:-}",
  eqqcolon: "\\mathrel{=:}",
  Eqqcolon: "\\mathrel{=::}",
  eqcolon: "\\mathrel{-:}",

  // --- Named delimiters from `unicode-math` -----------------------------
  lparen: "(",
  rparen: ")",
  lang: "\\langle",
  rang: "\\rangle",

  // --- Degree -----------------------------------------------------------
  // The empty group gives the superscript a base, so the result stays valid
  // wherever the command appeared.
  degree: "{}^\\circ",

  // --- KaTeX's HTML-entity style arrow aliases --------------------------
  darr: "\\downarrow",
  uarr: "\\uparrow",
  rarr: "\\rightarrow",
  larr: "\\leftarrow",
  harr: "\\leftrightarrow",
  dArr: "\\Downarrow",
  uArr: "\\Uparrow",
  rArr: "\\Rightarrow",
  lArr: "\\Leftarrow",
  hArr: "\\Leftrightarrow",
  Darr: "\\Downarrow",
  Uarr: "\\Uparrow",
  Rarr: "\\Rightarrow",
  Larr: "\\Leftarrow",
  Harr: "\\Leftrightarrow",

  // --- KaTeX's HTML-entity style symbol aliases -------------------------
  sub: "\\subset",
  sube: "\\subseteq",
  supe: "\\supseteq",
  isin: "\\in",
  exist: "\\exists",
  empty: "\\emptyset",
  infin: "\\infty",
  plusmn: "\\pm",
  bull: "\\bullet",
  sdot: "\\cdot",
  alef: "\\aleph",
  alefsym: "\\aleph",
  weierp: "\\wp",
  real: "\\Re",
  image: "\\Im",
  thetasym: "\\vartheta",
  natnums: "\\mathbb{N}",
  clubs: "\\clubsuit",
  diamonds: "\\diamondsuit",
  hearts: "\\heartsuit",
  spades: "\\spadesuit",
  Dagger: "\\ddagger",
  gggtr: "\\ggg",

  // --- Overlap boxes ----------------------------------------------------
  // Same arity as the base commands, so a token substitution is exact.
  mathllap: "\\llap",
  mathrlap: "\\rlap",
};

/**
 * Commands that are known to be renderer-specific but cannot be repaired by a
 * token substitution, either because they consume arguments in a way that
 * changes the surrounding structure or because MathJax has no equivalent.
 *
 * These are reported by the diagnostic rather than rewritten. Rewriting them
 * incorrectly would be worse than leaving TeX that a user can see and fix.
 */
export const UNSUPPORTED_COMMANDS: readonly string[] = [
  // KaTeX-only presentation and linking commands with no MathJax counterpart.
  "href",
  "htmlClass",
  "htmlId",
  "htmlStyle",
  "htmlData",
  "includegraphics",
  "KaTeX",
  // Need an argument template rather than a token swap.
  "utilde",
  "mathclap",
  "overparen",
  "underparen",
  // Depend on a MathJax extension that Obsidian may or may not autoload.
  // Reported so a real failure can be confirmed before anything is rewritten.
  "cancel",
  "bcancel",
  "xcancel",
  "bra",
  "ket",
  "braket",
  "Bra",
  "Ket",
  "Braket",
  "ketbra",
  "Ketbra",
];

const UNSUPPORTED = new Set(UNSUPPORTED_COMMANDS);

const DEFINITION_PATTERN =
  /\\(?:re|provide)?newcommand\s*\{?\s*\\([a-zA-Z]+)|\\[gx]?def\s*\\([a-zA-Z]+)|\\let\s*\\([a-zA-Z]+)/g;

/**
 * Collects command names the expression defines for itself.
 *
 * An expression carrying its own `\newcommand{\degree}{...}` must keep that
 * definition rather than have its uses rewritten out from under it.
 */
function collectDefinedCommands(tex: string): Set<string> {
  const defined = new Set<string>();

  for (const match of tex.matchAll(DEFINITION_PATTERN)) {
    const name = match[1] ?? match[2] ?? match[3];
    if (name) defined.add(name);
  }

  return defined;
}

/**
 * Walks the control words of a TeX expression.
 *
 * Control words are matched whole, so `\rarr` is visited while `\rarrow` is
 * left intact, and escaped pairs such as `\\` or `\$` are stepped over rather
 * than read as commands.
 */
function scanCommands(
  tex: string,
  visit: (name: string, start: number, end: number) => string | null,
): string {
  let output = "";
  let index = 0;

  while (index < tex.length) {
    const character = tex[index];

    if (character !== "\\") {
      output += character;
      index += 1;
      continue;
    }

    const next = tex[index + 1];

    // An escaped character such as \\, \{, \% or \_ is not a control word.
    if (next === undefined || !isLetter(next)) {
      output += tex.slice(index, index + 2);
      index += next === undefined ? 1 : 2;
      continue;
    }

    let end = index + 1;
    while (end < tex.length && isLetter(tex[end])) end += 1;

    const replacement = visit(tex.slice(index + 1, end), index, end);

    // The whitespace that terminated the control word is deliberately left in
    // place. Math mode ignores it, and consuming it would let a replacement
    // ending in a control word absorb the next token: `\rarr y` would become
    // `\rightarrowy`, an undefined command rather than an arrow.
    output += replacement === null ? tex.slice(index, end) : replacement;
    index = end;
  }

  return output;
}

/**
 * Rewrites commands Obsidian's MathJax cannot render into equivalents it can.
 * TeX that already renders is returned unchanged.
 */
export function applyMathJaxCompatibility(tex: string): string {
  if (!tex.includes("\\")) return tex;

  const defined = collectDefinedCommands(tex);

  return scanCommands(tex, (name) =>
    defined.has(name) ? null : (MATHJAX_REPLACEMENTS[name] ?? null),
  );
}

/**
 * Reports commands in an expression that this plugin knows Obsidian cannot
 * render and cannot repair automatically.
 *
 * This turns a silent post-paste rendering failure into something a user can
 * find deliberately, and produces the evidence needed to extend the tables
 * above.
 */
export function findUnsupportedCommands(tex: string): string[] {
  if (!tex.includes("\\")) return [];

  const defined = collectDefinedCommands(tex);
  const found = new Set<string>();

  scanCommands(tex, (name) => {
    if (UNSUPPORTED.has(name) && !defined.has(name)) found.add(name);
    return null;
  });

  return Array.from(found).sort();
}

function isLetter(character: string): boolean {
  return (
    (character >= "a" && character <= "z") ||
    (character >= "A" && character <= "Z")
  );
}

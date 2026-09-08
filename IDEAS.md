# Ideas and backlog

Running log of ideas, features, defects, and open questions for
ChatGPT Math Paste. Appended to as things come up, so that work can resume
across sessions without relying on conversation context.

Conventions:

- Newest entries are appended to the end of their section.
- Each entry records what it is, why it matters, and its current state.
- States: `open`, `in progress`, `done`, `rejected`, `needs verification`.
- Nothing here is a commitment. This is a capture surface, not a roadmap.

---

## Defects

### D1 — KaTeX-only TeX commands fail to render in Obsidian's MathJax

State: `done` (1.2.0, confirmed fixed in Obsidian 2026-09-08)
Reported: 2026-09-08, from a normal paste into a Markdown note.

Observed: a pasted display equation rendered inside a box with one token in
red:

```text
\iiint_V (\nabla \cdot \mathbf{F})\, dV = \oiint_{\partial V} \mathbf{F} \cdot d\mathbf{A}
```

Everything rendered except `\oiint`, which appeared as literal red text.

Diagnosis: this is not a clipboard or conversion defect. The converter
correctly extracted the original TeX from the MathML annotation. The red,
boxed output is MathJax's `merror` rendering of an undefined control
sequence.

Root cause: a renderer dialect gap. The source application renders with
KaTeX, which supports `\oiint`. Obsidian renders with MathJax, whose default
package set (base and ams) does not define `\oiint`; it belongs to `esint`.
Faithful TeX extraction is therefore necessary but not sufficient. Output
must also be expressible in the destination renderer's dialect.

Significance: `\oiint` is one instance of a class. Any command KaTeX
supports and Obsidian's MathJax does not will fail the same way, silently,
after a paste that appeared to succeed.

Fix: a TeX compatibility layer (`src/tex-compat.ts`) rewrites the affected
commands into equivalents built only from MathJax's default packages, applied
to extracted TeX before it is written into the note. Also applied to existing
notes through `src/markdown-math.ts`, so a note that was already pasted can be
repaired in place. See I1, I4, I5.

---

## Ideas and features

### I1 — TeX compatibility mapping table (KaTeX to MathJax)

State: `done` (1.2.0)

A single, documented, testable table mapping commands that KaTeX supports
but Obsidian's MathJax does not, to equivalents built only from commands
MathJax defines by default. Applied to extracted TeX at paste time so the
resulting note renders in stock Obsidian with no plugin or preamble
dependency.

Design constraints:

- Replacements must use only base and ams commands.
- Rewriting must not touch TeX that already renders correctly.
- The table must be data, not scattered conditionals, so entries can be
  added from a single failing report.
- Every entry needs a regression test.

Implemented as `MATHJAX_REPLACEMENTS` in `src/tex-compat.ts`. A test asserts
that every replacement is itself free of commands needing rewriting, so an
entry cannot silently depend on another gap.

### I2 — Runtime MathJax macro injection (alternative to I1)

State: `open`

Rather than rewriting the TeX, define the missing macros on Obsidian's
MathJax instance at plugin load so the original `\oiint` renders as written.

Trade-off against I1: notes keep verbatim upstream TeX, but they then render
only where this plugin is installed and enabled. Notes break in Obsidian
Publish, in another vault, or for anyone the note is shared with. The
Obsidian API exposes `loadMathJax`, `renderMath`, and `finishRenderMath`,
but no typed macro registration, so this would depend on undocumented
internals.

Possible resolution: implement I1 as the default and offer I2 as an opt-in
setting for users who prioritise verbatim TeX over portability.

### I3 — Candidate compatibility gaps to verify empirically

State: `needs verification` (table shipped; entries still unconfirmed)

Suspected KaTeX-supported commands absent from Obsidian's default MathJax
configuration. Each needs to be confirmed in a real vault before being added
to the I1 table; guessing risks rewriting TeX that already worked.

- `\oiint` (confirmed failing, see D1), `\oiiint` (assumed, same family)
- `\coloneqq`, `\Coloneqq`, `\eqqcolon`, `\coloneq`
- `\lparen`, `\rparen`
- `\darr`, `\uarr`, `\rarr`, `\lArr`, `\rArr`, `\dArr`, `\uArr`
- `\degree`
- `\mathllap`, `\mathrlap`, `\mathclap`
- `\overparen`, `\underparen`
- `\utilde`
- `\bra`, `\ket`, `\braket`, `\Bra`, `\Ket`
- `\href`, `\htmlClass`, `\htmlId`, `\htmlStyle` (KaTeX-specific, no MathJax
  equivalent; likely strip to the visible argument)

Method: paste each into a scratch note, record which produce MathJax
`merror` output, and confirm or remove the corresponding table entry.

The broad table was shipped ahead of this verification by explicit choice,
preferring coverage over minimalism. The residual risk is rewriting a command
that already rendered, which changes note source without breaking rendering.
The reverse risk, silent failure, was judged worse.

### I4 — Apply the compatibility layer to the plain-text path

State: `done` (1.2.0)

The compatibility layer belongs on the rich clipboard path first, where math
boundaries are known exactly. The plain-text path and the two normalization
commands operate on Markdown where math regions are only implied by
delimiters. Extending compatibility rewriting there requires identifying
`$...$` and `$$...$$` regions while continuing to respect code spans and
fences.

Implemented as `src/markdown-math.ts`. Inline regions must be single-line,
non-empty, and unpadded so that prose such as "$5 and $10" is not read as an
expression. This is what makes repairing an already-pasted note possible.

### I5 — Diagnostic command for unsupported commands

State: `done` (1.2.0)

A Command Palette action that scans the current note's math regions and
reports commands the compatibility layer does not know about. Turns a silent
post-paste rendering failure into something the user can find deliberately,
and produces good bug reports for I3.

### I6 — Argument-template replacements

State: `open`

The compatibility layer substitutes single tokens, which is exact when arity
matches (`\mathllap` to `\llap`) but cannot express replacements that
restructure their arguments: `\ket{\psi}` to `\left|\psi\right\rangle`,
`\utilde{x}` to `\underset{\sim}{x}`, `\overparen`, `\mathclap`.

Would need a brace-matching argument reader and `#1`-style templates. Deferred
deliberately: it is a real new risk surface (mismatched braces in user TeX),
and the commands that would need it are all still unverified under I3. Those
commands are reported by the diagnostic in the meantime.

### I7 — Verify the kerning of the composed integral operators

State: `partly verified` (2026-09-08)

`\oiint` and `\oiiint` are composed as `\int\!\!\!\!\int` with the circle
pulled back by `\mkern-21mu` and `\mkern-31mu` respectively. The double
integral value is the widely used one; the triple integral value was derived
by analogy and has not been checked visually.

`\oiint` was confirmed visually in Obsidian on 2026-09-08: the circle is
centred over the double integral and the `\partial V` subscript sits in the
expected place at display size. `\oiiint` remains unverified.

### I8 — Consider whether the normalize commands should also repair math

State: `open`

The two original "Normalize math delimiters" commands still only convert
delimiters. The new "Fix math commands Obsidian cannot render" command does
delimiters and compatibility together. Four commands may be more surface than
this deserves; merging them would be simpler but changes documented behaviour.

---

## Open questions

### Q1 — Which MathJax packages does Obsidian actually load?

State: `open`

The whole compatibility surface depends on this, and it is currently an
assumption rather than a verified fact. It may also change between Obsidian
releases, which would make I1's table version-sensitive. Worth pinning down
and recording here, along with the Obsidian version it was checked against.

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

### D2 — Escaped-dollar clipboard Markdown bypasses conversion

State: `done` (1.2.2)
Reported: 2026-10-29, from a normal ChatGPT paste into an Obsidian note.

Observed: inline and display delimiters arrived as `\$...\$` and
`\$$...\$$`, with TeX subscripts escaped as `\_`. Citation images and HTML
entities from Obsidian's default rich-paste conversion appeared alongside the
unrendered source.

Diagnosis: the rich path only recognized MathML TeX annotations. With no
annotation it returned control to Obsidian, while the plain path only
recognized `\(...\)` and `\[...\]`. Neither path claimed the new serialized
form.

Fix: after Obsidian serializes clipboard HTML, the converter now recognizes
paired escaped-dollar regions, restores serializer-escaped subscripts only
inside those regions, and applies the existing MathJax compatibility rewrite.
The scanner excludes inline code and fenced blocks and rejects unmatched or
padded inline delimiters.

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

State: `done` (verified in Obsidian 2026-09-08)

Verified in Obsidian on 2026-09-08 by opening a generated fixture covering
every table entry. The result substantially pruned both tables.

Confirmed failing, kept in the table:

- `\oiint`, `\oiiint`
- `\lang`, `\rang`
- all fifteen arrow aliases (`\darr`, `\rArr`, `\Harr`, ...)
- twenty-two symbol aliases (`\sub`, `\isin`, `\infin`, `\alef`, ...)

Confirmed rendering natively, removed from the table:

- `\coloneqq`, `\Coloneqq`, `\coloneq`, `\eqqcolon`, `\Eqqcolon`,
  `\eqcolon` — and notably the replacements rendered *worse* than the
  originals, introducing spurious spacing in `:-` and `-:`
- `\lparen`, `\rparen`
- `\degree`
- `\gggtr`
- `\mathllap`, `\mathrlap`

Confirmed rendering natively, removed from the unsupported list:

- `\href`, `\mathclap`, `\overparen`, `\underparen`
- `\cancel`, `\bcancel`, `\xcancel`
- `\bra`, `\ket`, `\braket`, `\Bra`, `\Ket`, `\Braket`, `\ketbra`,
  `\Ketbra`

Still failing, so still reported by the diagnostic: `\htmlClass`, `\htmlId`,
`\htmlStyle`, `\htmlData`, `\includegraphics`, `\KaTeX`, `\utilde`.

Twelve of fifty-three replacement entries and fifteen of twenty-two
unsupported entries were wrong. Shipping the broad table ahead of verification
was the right call for coverage but produced a real error rate, and the colon
relations show the concrete cost: a rewrite can be worse than no rewrite.
Verify before adding, now that a fixture generator exists.

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

State: `done` (1.2.1) — and the approach it assumed was abandoned

`\oiint` and `\oiiint` are composed as `\int\!\!\!\!\int` with the circle
pulled back by `\mkern-21mu` and `\mkern-31mu` respectively. The double
integral value is the widely used one; the triple integral value was derived
by analogy and has not been checked visually.

`\oiint` is correct at display size, confirmed 2026-09-08.

`\oiiint` is wrong: at `-31mu` the circle overshoots to the left, overlapping
the first integral sign and colliding with the subscript. Deriving from the
working `\oiint` value, where the circle centre must land at half the operator
width, gives `|k| = W/2 + C/2` with `W2 = 2w - 12mu` and `W3 = 3w - 24mu`, so
`|k3| = 0.5w + 15`, or roughly 24 to 25mu rather than 31.

Round 2 (Obsidian 1.13.7) settled the display case and disproved the whole
approach for the inline case:

- `-24mu` is correct for `\oiiint` at display size, as derived.
- No kern value fixes inline rendering. At `-21mu` and `-24mu` the circle is
  drawn *outside its own box* and covers the preceding character; a colon
  immediately before the symbol disappears underneath it. `\mathchoice` with
  a text-style kern of `-17mu` still collides.

Root cause: the construction typesets the integrals, kerns backwards, then
draws the circle, so the box's advance width is `W/2 + C/2` while its visual
extent is `W`. In text style `\int` is narrow enough that `W` is smaller than
the kern, and the circle lands at a negative offset. This is a box-width
defect, not a kerning defect, which is why tuning the constant cannot fix it.

Resolved in 1.2.1 by abandoning kerning entirely rather than tuning it.

The construction now centres the integrals and the circle on each other with
`\mathclap`, which has zero width, and derives the operator's width from
symmetric padding on either side. Because the padding is symmetric it cannot
shift the contents off centre, so centring is exact by construction with no
constant to tune. Only the width needs a value, chosen per math style with
`\mathchoice`, and it merely has to be at least half the widest component.

Measured with MathJax locally rather than by inspection. Before: circle at
`[-448, 552]` against integrals at `[0, 719]` in text style, 448 units of ink
outside the box, 308 off centre. After: 0 off centre and ink within the box in
both styles, for both commands.

This is the entry to re-read before adding any composed symbol. The lesson is
that a symbol can be centred and still be broken, because the box matters
independently of what is drawn in it, and that eyeballing a screenshot cannot
distinguish the two.

### I8 — Consider whether the normalize commands should also repair math

State: `open`

The two original "Normalize math delimiters" commands still only convert
delimiters. The new "Fix math commands Obsidian cannot render" command does
delimiters and compatibility together. Four commands may be more surface than
this deserves; merging them would be simpler but changes documented behaviour.

### I9 — Rendering tests

State: `done` (1.2.1)

`tests/mathjax-render.test.ts` runs replacements through MathJax and asserts
that they render and that composed symbols keep their ink inside their box.
`mathjax-full` is a development dependency for this; it is 40MB with seven
transitive dependencies, which is a real cost, accepted because silent
rendering failure is this project's core defect class and was previously
detectable only by hand in a vault.

The suite is mutation-tested: restoring the 1.2.0 construction fails four
assertions, a replacement using an undefined command fails two, and an
under-sized padding constant fails one.

Note that MathJax's `noundefined` extension is deliberately excluded from the
test configuration. It is what makes Obsidian draw an unknown command as red
text instead of failing, which is exactly the silent failure being guarded
against; excluding it turns that into a hard error the tests can see.

---

## Open questions

### Q1 — Which MathJax packages does Obsidian actually load?

State: `answered enough to work with` (Obsidian 1.13.7)

The whole compatibility surface depends on this, and it is currently an
assumption rather than a verified fact. It may also change between Obsidian
releases, which would make I1's table version-sensitive.

Evidence from the I3 fixture: autoload is clearly enabled. `\cancel`,
`\bcancel`, `\xcancel`, the whole `braket` family, `\href`, `\mathclap`,
`\overparen`, and `\underparen` all render, and the `mathtools` colon
relations are present. Only KaTeX-specific HTML commands and `\utilde` fail.
This is a much larger surface than base plus ams alone.

All compatibility results in this file were observed on **Obsidian 1.13.7**.
Re-verify with the fixture generator if a future Obsidian changes its MathJax
configuration.

`\unicode` resolves, and raw `\u222F` / `\u2230` characters render too. The
glyphs are correct but stay text-sized: unlike `\int`, they do not grow in
display style, so they look undersized beside a real `\iiint`.

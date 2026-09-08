# Changelog

All notable changes to this project are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

## [1.2.1] - 2026-09-08

### Fixed

- Closed integrals (`\oiint`, `\oiiint`) drew their circle outside the
  operator's own box in inline math, painting over the preceding character.
  The box was narrower than its contents, so no kerning value could fix it;
  the construction now centres the circle and the integrals on each other and
  derives its width symmetrically, which is correct in every math style.
- `\oiiint` was additionally mis-kerned at display size.

### Changed

- Removed twelve replacements for commands Obsidian renders natively, after
  verifying each in Obsidian 1.13.7. Rewriting them was unnecessary, and for
  the colon relations the replacement rendered worse than the original.
- Removed fifteen commands from the unsupported-command diagnostic for the
  same reason, including the whole `braket` family, the `cancel` family, and
  `\href`.

### Added

- Rendering tests that run TeX through MathJax and assert both that every
  replacement renders and that closed integrals keep their ink inside their
  box. These catch, automatically, the class of defect that previously
  required manual inspection in a vault.

## [1.2.0] - 2026-09-08

### Added

- A TeX compatibility layer that rewrites math commands KaTeX supports but
  Obsidian's MathJax does not, so extracted equations render rather than
  appearing as red literal text in a MathJax error box.
- Repair of math in existing notes: a command that normalizes delimiters and
  applies the compatibility rewrite to `$...$` and `$$...$$` regions.
- A diagnostic command reporting math commands known to be unrenderable in
  Obsidian that cannot be repaired automatically.
- A setting to disable the compatibility rewrite and keep source TeX verbatim.
- `IDEAS.md`, a running capture surface for ideas, defects, and open questions.

### Fixed

- `\oiint` and other KaTeX-only commands failed to render after an otherwise
  successful paste. The TeX was extracted correctly; the failure was a dialect
  gap between the source renderer and Obsidian's. Confirmed fixed in Obsidian.

## [1.1.0] - 2026-09-03

### Added

- Public architecture and continuation documentation.
- Privacy, security, trust-boundary, and vulnerability-reporting documentation.
- GitHub Actions checks for supported Node.js versions.
- Public release and manual acceptance-test instructions.
- A reboot-safe current-state handoff, release checklist, and checksum workflow.

### Changed

- Normalized the release line from the development version to `1.1.0`.
- Reworked documentation so it contains no machine-specific paths, vault names,
  or private environment details.

### Removed

- The original full diagnostic conversation and operating-system metadata from
  the distributable project tree.

## [1.0.0] - 2026-08-30

### Added

- Automatic extraction of TeX from rich KaTeX/MathML clipboard HTML.
- Obsidian-compatible inline and display math delimiters.
- Plain Markdown delimiter normalization outside code spans and fences.
- Selection and whole-note normalization commands.
- Configurable automatic conversion and notifications.
- Converter regression tests and production build tooling.

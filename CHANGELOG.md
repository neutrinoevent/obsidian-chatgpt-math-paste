# Changelog

All notable changes to this project are documented here. Versions follow
[Semantic Versioning](https://semver.org/).

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

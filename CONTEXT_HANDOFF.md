# Context handoff: ChatGPT Math Paste

Last updated: 2026-09-08

This file preserves the reasoning and implementation state needed to resume
work without relying on private machine or vault context.

## Start here after a reboot

1. Read this file, `README.md`, `CHANGELOG.md`, `SECURITY.md`, and `IDEAS.md`.
2. Confirm `package.json` and `manifest.json` both report version `1.2.0`.
3. Restore dependencies and verify the repository:

   ```bash
   npm ci
   npm run check
   npm audit --audit-level=low
   shasum -a 256 -c SHA256SUMS
   ```

4. Do not search for, inspect, or modify an Obsidian vault unless the user
   explicitly requests installation or vault testing in that session.
5. Do not publish, create a remote, or push until the user explicitly requests
   that external action and the Git author identity has been reviewed.

## Current checkpoint

- Source and release version: `1.2.0`.
- Intended repository: `https://github.com/neutrinoevent/obsidian-chatgpt-math-paste`.
- Git identity in use: `neutrinoevent` with the GitHub noreply address, so
  commit metadata carries no real name or personal email. Re-check this before
  the first commit rather than assuming it.
- Functional state: manually tested successfully in Obsidian, including unusual
  math cases. The `1.2.0` renderer compatibility fix was confirmed in Obsidian
  on 2026-09-08 by re-pasting the response that originally failed.
- Automated state: 23 tests pass across three suites, the production bundle
  builds, and the dependency audit reported zero known vulnerabilities at the
  last check.
- Release artifact: `chatgpt-math-paste-1.2.0.zip`. The superseded
  `chatgpt-math-paste-1.1.0.zip` may still be present locally; it was never
  published and is ignored by Git.
- Release checksum: stored separately in `SHA256SUMS` so the ZIP does not contain
  a self-referential checksum.
- Publication state: the tree is a local Git repository on `main` with a single
  reviewed source commit authored as `neutrinoevent` with the GitHub noreply
  address. There is no tag, GitHub remote, GitHub release, or Obsidian
  community-plugin submission yet. The sweep preceding that commit found no
  absolute paths, usernames, emails, secrets, vault references, or macOS
  metadata.
- `SHA256SUMS` is ignored by Git by deliberate choice: a checksum is only
  meaningful next to the archive it covers, so both are release assets rather
  than source.
- Privacy state: the public tree and release archive were scanned for absolute
  home paths, local usernames, vault names, credential patterns, unsafe archive
  paths, and macOS metadata. The scans were clean.
- Local installation state: an earlier build was installed and manually tested,
  but the public-release cleanup intentionally did not modify any vault. Never
  infer a vault location from this repository.
- Generated state: `main.js` and release ZIPs are intentionally ignored by Git.
  They exist locally for testing/release but must be attached separately to a
  GitHub release.

## Objective

Make responses containing LaTeX, inline equations, display equations, headings,
lists, code, and ordinary Markdown paste cleanly into Obsidian without duplicate
or unrenderable math.

## Root cause

A rendered equation can place an accessible MathML rendering, a TeX annotation,
and a visual KaTeX rendering on the clipboard. A plain-text paste may flatten
those representations together. At that point the boundary between the
rendered copy and original TeX is ambiguous.

The reliable intervention point is Obsidian's `editor-paste` event, before the
clipboard structure is lost. The original expression is available in a MathML
`<annotation>` whose encoding is `application/x-tex` or
`application/x-latex`.

## Current architecture

`src/main.ts` owns the Obsidian boundary:

- registers the `editor-paste` event through the plugin lifecycle;
- reads `text/html` and `text/plain` clipboard representations;
- uses Obsidian's `htmlToMarkdown` helper;
- replaces the current editor selection only when conversion succeeds;
- exposes selection and whole-note normalization commands; and
- persists three boolean settings through Obsidian's plugin data API.

`src/tex-compat.ts` and `src/markdown-math.ts` are also independent of
Obsidian. The first holds the KaTeX-to-MathJax command tables and the rewriting
scanner; the second locates `$...$` and `$$...$$` regions in existing Markdown
while respecting code spans and fences.

`src/converter.ts` is independent of Obsidian:

- parses rich HTML with the browser `DOMParser`;
- finds supported TeX annotations;
- removes the complete KaTeX display or inline wrapper;
- uses temporary markers to survive HTML-to-Markdown conversion;
- restores inline or display dollar delimiters;
- normalizes plain `\(...\)` and `\[...\]` delimiters;
- skips delimiter conversion inside Markdown code spans and fences; and
- rewrites extracted TeX into MathJax's dialect before it reaches the note.

The separation lets converter behavior run under a DOM test environment without
starting Obsidian.

## Intentional trust boundaries

- Conversion starts only from a user-initiated editor paste or explicit command.
- Clipboard HTML is parsed without executing scripts.
- The plugin has no direct filesystem, network, process, shell, API-key,
  telemetry, or note-scanning code.
- Unrecognized clipboard HTML is left to Obsidian.
- Existing flattened duplicate text is not heuristically rewritten because a
  general repair would risk corrupting legitimate prose or TeX.

## Tests and verification

`tests/converter.test.ts` currently covers:

- removal of duplicate inline visual content;
- preservation of original inline TeX;
- display-math delimiter selection;
- no-op behavior for unrelated HTML;
- normalization of inline and display delimiters; and
- protection of inline and fenced code;
- rewriting of commands MathJax cannot render, including the reported
  `\oiint` case end to end through the rich clipboard path;
- whole-word control-word matching, escaped-character handling, and respect
  for definitions an expression provides for itself;
- the invariant that no replacement itself contains a command needing
  rewriting;
- math-region detection in existing Markdown, including currency, escaped
  dollars, code spans, and fences; and
- the verbatim-TeX opt-out.

The public-release verification sequence is:

```bash
npm ci
npm run check
npm audit
```

Manual acceptance testing should include:

1. rich inline math embedded in prose;
2. standalone display math;
3. multiple equations in one response;
4. headings, lists, block quotes, and fenced code around math;
5. unusual TeX commands, matrices, and alignment environments;
6. plain Markdown containing `\(...\)` and `\[...\]`; and
7. ordinary clipboard content that must remain unchanged.

The `1.0.0` implementation was manually validated in Obsidian with ordinary and
unusual math cases. Automated tests and the production build passed before the
`1.1.0` public-release cleanup.

The `1.1.0` documentation, production build, release archive, privacy scan, and
checksum were refreshed on 2026-09-03 for post-reboot continuity.

On 2026-09-08 a renderer dialect defect was fixed: math extracted correctly
from the clipboard could still fail to render because ChatGPT uses KaTeX and
Obsidian uses MathJax. The fix was verified in Obsidian, then prepared as
`1.2.0` with the version, documentation, release archive, and checksum all
refreshed together.

## Release history and rationale

- `1.0.0`: first working native Obsidian implementation and manual validation.
- `1.1.0`: public-release preparation, version normalization, privacy cleanup,
  expanded architecture/security documentation, and continuous integration.
- `1.2.0`: KaTeX-to-MathJax renderer compatibility, repair of existing notes,
  an unsupported-command diagnostic, and `IDEAS.md`.

Extracting the original TeX faithfully is necessary but not sufficient. The
`1.2.0` work established the second half of the problem: output must also be
expressible in the destination renderer's dialect. Treat any future "renders in
ChatGPT, fails in Obsidian" report as a compatibility table entry rather than a
clipboard defect.

The original full pasted conversation used during diagnosis is intentionally
not part of the public tree. Synthetic, minimal regression fixtures provide the
needed coverage without publishing unrelated user content.

## Safe continuation procedure

If a new clipboard format fails:

1. reproduce it in a temporary note, never a valuable note;
2. capture the smallest possible sanitized `text/html` fixture;
3. remove names, paths, note content, account identifiers, and unrelated prose;
4. add a failing regression test;
5. update `src/converter.ts` without broadening interception of normal pastes;
6. run `npm run check` and `npm audit`; and
7. manually verify both Live Preview and Reading view.

Do not add real vault paths, raw private conversations, clipboard dumps, API
keys, Obsidian configuration files, or generated operating-system metadata to
the repository.

## Publication continuation

Use `RELEASE_CHECKLIST.md` as the authoritative publication sequence. Important
state that a new session must preserve:

- Review `git config user.name` and `git config user.email` before the first
  commit; commit metadata can reveal an identity even when repository files do
  not.
- Initialize Git only when publication work is requested.
- Inspect the exact staged file list before committing. `node_modules`,
  `.DS_Store`, `main.js`, ZIP files, plugin `data.json`, and coverage output must
  remain excluded.
- Tag the release as `1.2.0` or `v1.2.0` consistently with the chosen repository
  convention. Obsidian manifests use the value without a leading `v`.
- Upload `chatgpt-math-paste-1.2.0.zip` and `SHA256SUMS` as release assets because
  both are intentionally outside normal source control.
- Enabling private vulnerability reporting is a repository-owner action to take
  before or immediately after making the repository public.

## Release construction

After `npm run check`, construct the release ZIP from the project root:

```bash
COPYFILE_DISABLE=1 zip -X -j chatgpt-math-paste-1.2.0.zip \
  manifest.json main.js versions.json README.md LICENSE \
  CONTEXT_HANDOFF.md CHANGELOG.md SECURITY.md RELEASE_CHECKLIST.md IDEAS.md
```

Then verify the archive before updating `SHA256SUMS`:

```bash
unzip -t chatgpt-math-paste-1.2.0.zip
zipinfo -1 chatgpt-math-paste-1.2.0.zip
shasum -a 256 chatgpt-math-paste-1.2.0.zip
```

Expected entries are relative top-level filenames only. Reject entries beginning
with `/`, containing `..`, or named `.DS_Store` or `__MACOSX`.

## Dependency and CI decisions

- Runtime bundle dependency: only Obsidian, kept external by esbuild.
- All npm packages are development/test dependencies; the plugin ships no npm
  dependency tree.
- Node.js 18 remains the minimum development version for this release.
- Newer major versions of several build/test packages exist, but they were not
  forced into the already validated release. Upgrade them as a separate change
  with a Node support review and full regression run.
- GitHub CI tests Node.js 18, 20, and 22. At the last review it used the official
  `actions/checkout@v7` and `actions/setup-node@v7` major releases.

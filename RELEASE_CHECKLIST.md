# Release checklist

This checklist is intentionally repository-relative and contains no machine or
vault paths.

## 1. Confirm release metadata

- `package.json` version matches `manifest.json`.
- `versions.json` maps the release version to the intended minimum Obsidian
  version.
- `CHANGELOG.md` contains the release version and date.
- `SECURITY.md` marks the release line as supported.
- `IDEAS.md` entries resolved by the release are marked `done` with the
  release version rather than `unreleased`.
- The plugin manifest contains only intended public attribution.

For `1.2.2`, the expected minimum Obsidian version is `1.5.0`.

## 2. Reproduce the verified build

```bash
npm ci
npm run check
npm audit --audit-level=low
```

Expected baseline for `1.2.2`:

- all tests pass (123 at the last check);
- TypeScript type-checking succeeds;
- esbuild produces `main.js`; and
- the runtime bundle contains no npm dependencies. As of 2026-10-29, `npm
  audit` reports seven findings in development and test dependencies; review
  them separately from the shipped plugin rather than treating the old
  zero-finding baseline as current.

## 3. Perform manual acceptance testing

In a temporary Obsidian note, verify:

- inline math embedded in prose;
- standalone display math;
- multiple equations in one response;
- matrices, aligned equations, boxes, text commands, hats, vectors, and unusual
  TeX constructs;
- headings, lists, block quotes, and code around equations;
- plain `\(...\)` and `\[...\]` delimiter conversion;
- escaped `\$...\$` and `\$$...\$$` clipboard conversion, including
  serializer-escaped subscripts;
- commands the renderer compatibility table rewrites, in particular `\oiint`
  and `\oiiint`, checked visually at display and inline size;
- the compatibility repair and diagnostic commands on an existing note;
- inline and fenced code remaining unchanged; and
- an ordinary non-math paste remaining under Obsidian's normal behavior.

Never use a valuable note for release testing.

## 4. Audit the public tree

Confirm the source tree contains no:

- absolute home or vault paths;
- local usernames, vault names, or account identifiers;
- private conversations or raw clipboard dumps;
- secrets, credentials, tokens, or API keys;
- `.DS_Store`, `__MACOSX`, editor metadata, or coverage output;
- Obsidian `data.json` settings; or
- generated dependency directories.

Review application capabilities as well as text patterns. The expected plugin
has no network requests, direct filesystem calls, process execution, shell
commands, telemetry, background note scanning, or credential access.

## 5. Build and verify the release archive

```bash
COPYFILE_DISABLE=1 zip -X -j chatgpt-math-paste-1.2.2.zip \
  manifest.json main.js versions.json README.md LICENSE \
  CONTEXT_HANDOFF.md CHANGELOG.md SECURITY.md RELEASE_CHECKLIST.md IDEAS.md

unzip -t chatgpt-math-paste-1.2.2.zip
zipinfo -1 chatgpt-math-paste-1.2.2.zip
shasum -a 256 chatgpt-math-paste-1.2.2.zip
```

Update `SHA256SUMS` with the final digest and confirm it:

```bash
shasum -a 256 -c SHA256SUMS
```

Do not modify any archived file after generating the checksum. If anything
changes, rebuild the archive and replace the checksum.

## 6. Prepare Git safely

Before creating the release commit, inspect the configured Git identity:

```bash
git config user.name
git config user.email
```

Initialize and stage only after confirming that metadata is appropriate for a
public repository. Inspect both normal and ignored files before committing:

```bash
git status --short
git status --short --ignored
git diff --cached --stat
git diff --cached
```

Generated `main.js`, ZIP archives, `node_modules`, `.DS_Store`, plugin
`data.json`, and coverage output should not enter the source commit.

## 7. Publish

- Create the public GitHub repository only with explicit authorization.
- Push the reviewed source commit.
- Create the chosen `1.2.2`/`v1.2.2` tag convention.
- Attach `chatgpt-math-paste-1.2.2.zip` and `SHA256SUMS` to the GitHub release.
- Enable private vulnerability reporting under the repository's Security
  settings.
- Confirm GitHub Actions passes on all configured Node.js versions.
- Download the uploaded ZIP once and verify its checksum independently.

Submission to Obsidian's community plugin directory is a separate external
workflow and should not be inferred from publishing a GitHub release.

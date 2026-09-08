# Security policy

## Supported versions

Security fixes are applied to the latest release line.

| Version | Supported |
| --- | --- |
| 1.2.x | Yes |
| 1.1.x and earlier | No |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use the repository's
private **Security → Advisories → Report a vulnerability** workflow at
<https://github.com/neutrinoevent/obsidian-chatgpt-math-paste/security/advisories>. Include a
minimal reproduction, affected version, expected impact, and relevant platform
information. Remove note contents, vault paths, account identifiers, clipboard
data unrelated to the reproduction, and all credentials before submitting.

If private vulnerability reporting has not yet been enabled for the repository,
the maintainer should enable it before the first public release.

## Security and privacy model

The plugin operates locally within Obsidian. It processes clipboard content in
memory only after a user pastes into a Markdown editor. It has no application
code for network access, direct filesystem access, process execution, shell
commands, telemetry, analytics, API calls, credential access, or background note
scanning.

The plugin persists only three boolean preferences by using Obsidian's standard
plugin data API. It does not persist clipboard content.

## Trust boundaries

- Clipboard HTML and text are untrusted input.
- HTML parsing uses the browser DOM parser; the plugin does not execute scripts.
- Surrounding rich content is passed to Obsidian's own `htmlToMarkdown` helper.
- Resulting Markdown is inserted into the editor in response to the paste.
- Obsidian, installed themes/plugins, and the browser or application producing
  clipboard content remain outside this project's security boundary.

Users should review unfamiliar pasted content and keep Obsidian and installed
plugins updated.

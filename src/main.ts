import {
  App,
  Editor,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  htmlToMarkdown,
} from "obsidian";
import {
  convertMathHtmlToMarkdown,
  normalizeMathDelimiters,
} from "./converter";
import {
  collectMathRegions,
  transformMathRegions,
} from "./markdown-math";
import {
  applyMathJaxCompatibility,
  findUnsupportedCommands,
} from "./tex-compat";

interface MathPasteSettings {
  automaticPasteConversion: boolean;
  normalizePlainMarkdown: boolean;
  mathJaxCompatibility: boolean;
  showSuccessNotice: boolean;
}

const DEFAULT_SETTINGS: MathPasteSettings = {
  automaticPasteConversion: true,
  normalizePlainMarkdown: true,
  mathJaxCompatibility: true,
  showSuccessNotice: false,
};

export default class ChatGptMathPastePlugin extends Plugin {
  override settings: MathPasteSettings = DEFAULT_SETTINGS;

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.registerEvent(
      this.app.workspace.on("editor-paste", (event, editor) => {
        this.handlePaste(event, editor);
      }),
    );

    this.addCommand({
      id: "normalize-math-delimiters",
      name: "Normalize math delimiters in selection",
      editorCheckCallback: (checking, editor) => {
        if (!editor.somethingSelected()) return false;
        if (!checking) {
          const original = editor.getSelection();
          const converted = normalizeMathDelimiters(original);
          editor.replaceSelection(converted);
          new Notice(
            converted === original
              ? "No ChatGPT math delimiters found"
              : "Math delimiters converted for Obsidian",
          );
        }
        return true;
      },
    });

    this.addCommand({
      id: "normalize-note-math-delimiters",
      name: "Normalize math delimiters in current note",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const original = editor.getValue();
        const converted = normalizeMathDelimiters(original);
        editor.setValue(converted);
        editor.setCursor(cursor);
        new Notice(
          converted === original
            ? "No ChatGPT math delimiters found"
            : "Math delimiters converted for Obsidian",
        );
      },
    });

    this.addCommand({
      id: "fix-unsupported-math-commands",
      name: "Fix math commands Obsidian cannot render in current note",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const original = editor.getValue();
        const converted = transformMathRegions(
          normalizeMathDelimiters(original),
          applyMathJaxCompatibility,
        );

        if (converted === original) {
          new Notice("No unrenderable math commands found");
          return;
        }

        editor.setValue(converted);
        editor.setCursor(cursor);
        new Notice("Math rewritten for Obsidian's renderer");
      },
    });

    this.addCommand({
      id: "report-unsupported-math-commands",
      name: "Report math commands Obsidian cannot render in current note",
      editorCallback: (editor) => {
        const unsupported = new Set<string>();

        for (const region of collectMathRegions(editor.getValue())) {
          for (const command of findUnsupportedCommands(region)) {
            unsupported.add(command);
          }
        }

        if (unsupported.size === 0) {
          new Notice("No known unrenderable math commands found");
          return;
        }

        const names = Array.from(unsupported)
          .sort()
          .map((command) => `\\${command}`)
          .join(", ");

        new Notice(`Obsidian may not render: ${names}`, 10000);
      },
    });

    this.addSettingTab(new MathPasteSettingTab(this.app, this));
  }

  private handlePaste(event: ClipboardEvent, editor: Editor): void {
    if (!this.settings.automaticPasteConversion || event.defaultPrevented) {
      return;
    }

    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const html = clipboard.getData("text/html");
    const convertedHtml = convertMathHtmlToMarkdown(
      html,
      (element) => htmlToMarkdown(element),
      { mathJaxCompatibility: this.settings.mathJaxCompatibility },
    );

    if (convertedHtml !== null) {
      event.preventDefault();
      editor.replaceSelection(convertedHtml);
      if (this.settings.showSuccessNotice) {
        new Notice("Pasted with ChatGPT math formatting");
      }
      return;
    }

    if (!this.settings.normalizePlainMarkdown) return;

    const plainText = clipboard.getData("text/plain");
    const normalized = this.repairPlainMarkdown(plainText);
    if (normalized === plainText) return;

    event.preventDefault();
    editor.replaceSelection(normalized);
    if (this.settings.showSuccessNotice) {
      new Notice("Pasted with Obsidian math delimiters");
    }
  }

  /** Delimiter normalization, then the renderer compatibility rewrite. */
  private repairPlainMarkdown(markdown: string): string {
    const normalized = normalizeMathDelimiters(markdown);
    if (!this.settings.mathJaxCompatibility) return normalized;

    return transformMathRegions(normalized, applyMathJaxCompatibility);
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class MathPasteSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: ChatGptMathPastePlugin,
  ) {
    super(app, plugin);
  }

  override display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName("Convert math while pasting")
      .setDesc(
        "Extract original LaTeX from rich ChatGPT clipboard data and paste Obsidian-compatible Markdown.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.automaticPasteConversion)
          .onChange(async (value) => {
            this.plugin.settings.automaticPasteConversion = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(this.containerEl)
      .setName("Normalize plain Markdown delimiters")
      .setDesc("Convert \\(...\\) and \\[...\\] to Obsidian dollar delimiters.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.normalizePlainMarkdown)
          .onChange(async (value) => {
            this.plugin.settings.normalizePlainMarkdown = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(this.containerEl)
      .setName("Rewrite math for Obsidian's renderer")
      .setDesc(
        "ChatGPT renders math with KaTeX and Obsidian renders it with MathJax. Rewrite commands such as \\oiint that MathJax cannot render into equivalents that it can.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.mathJaxCompatibility)
          .onChange(async (value) => {
            this.plugin.settings.mathJaxCompatibility = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(this.containerEl)
      .setName("Show a notice after conversion")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showSuccessNotice)
          .onChange(async (value) => {
            this.plugin.settings.showSuccessNotice = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}

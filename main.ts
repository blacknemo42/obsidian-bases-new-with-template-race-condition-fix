import { Plugin, TFile } from "obsidian";
import { processTemplate } from "./templater";
import {
  BasesTemplateSettings,
  DEFAULT_SETTINGS,
  BasesTemplateSettingTab,
} from "./settings";

export default class BasesTemplatePlugin extends Plugin {
  settings: BasesTemplateSettings;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new BasesTemplateSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(
        this.app.vault.on("create", async (file: TFile) => {
          if (!file.basename.startsWith("Untitled")) return;

          await new Promise((r) => setTimeout(r, 150));

          const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
          if (!fm) return;

          const value = fm[this.settings.templateProperty];
          if (!value) return;

          const values = Array.isArray(value) ? value : [value];
          const activeLeaf = this.app.workspace.getMostRecentLeaf();

          const templatesPlugin =
            (this.app as any).internalPlugins.plugins.templates;
          const templaterPlugin =
            (this.app as any).plugins.plugins["templater-obsidian"];

          const templatesEnabled = !!templatesPlugin?.enabled;
          const templaterEnabled = !!templaterPlugin;

          const templateFolder =
            templatesPlugin?.instance?.options?.folder?.toLowerCase();
          const templaterFolder =
            templaterPlugin?.settings?.templates_folder?.toLowerCase();

          const duplicatePluginDetected =
            templatesEnabled &&
            templaterEnabled &&
            templateFolder &&
            templaterFolder &&
            templateFolder === templaterFolder;

          for (const item of values) {
            if (typeof item !== "string") continue;

            const link = item.match(/\[\[(.*?)\]\]/)?.[1];
            if (!link) continue;

            const templateFile =
              this.app.metadataCache.getFirstLinkpathDest(link, file.path);
            if (!templateFile) continue;

            const templatePath = templateFile.path.toLowerCase();

            if (
              duplicatePluginDetected &&
              templaterEnabled &&
              templaterFolder &&
              templatePath.startsWith(templaterFolder)
            ) {
              const processed = await processTemplate(
                this.app,
                templateFile,
              );
              if (processed) {
                await this.app.vault.modify(file, processed);
              }
              continue;
            }
            
            if (
              templatesEnabled &&
              templateFolder &&
              templatePath.startsWith(templateFolder)
            ) {
              if (activeLeaf === this.app.workspace.getMostRecentLeaf()) {
                await this.app.workspace.openLinkText(file.path, "", false);
              }

              await templatesPlugin.instance.insertTemplate(templateFile);
              await new Promise((r) => setTimeout(r, 100));
              continue;
            }

            if (
              templaterEnabled &&
              templaterFolder &&
              templatePath.startsWith(templaterFolder)
            ) {
              const processed = await processTemplate(
                this.app,
                templateFile,
              );
              if (processed) {
                await this.app.vault.modify(file, processed);
              }
            }
          }

          const newLeaf = this.app.workspace.getMostRecentLeaf();
          if (activeLeaf && newLeaf && activeLeaf !== newLeaf) {
            newLeaf.detach();
          }
        }),
      );
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

import { PluginSettingTab, App, Setting } from 'obsidian';
import MyPlugin from './main';

export interface MyPluginSettings {}

export const DEFAULT_SETTINGS: MyPluginSettings = {};

export class MyPluginSettingTab extends PluginSettingTab {
  plugin: MyPlugin;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'My Plugin' });

    // new Setting(containerEl)
  }
}

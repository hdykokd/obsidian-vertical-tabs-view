import { PluginSettingTab, App } from 'obsidian';
import VerticalTabsView from './main';

export interface VerticalTabsViewSettings {}

export const DEFAULT_SETTINGS: VerticalTabsViewSettings = {};

export class VerticalTabsViewSettingTab extends PluginSettingTab {
  plugin: VerticalTabsView;

  constructor(app: App, plugin: VerticalTabsView) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Vertical Tabs View' });

    // new Setting(containerEl)
  }
}

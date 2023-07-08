import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { log } from './util/message';
import { VerticalTabsViewSettings, DEFAULT_SETTINGS, VerticalTabsViewSettingTab } from './setting';
import { VerticalTabsViewView, VIEW_TYPE_VERTICAL_TABS } from './view';

export default class VerticalTabsView extends Plugin {
  settings: VerticalTabsViewSettings;

  async onload() {
    log('loading...');
    await this.loadSettings();
    this.addSettingTab(new VerticalTabsViewSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(async () => {
      this.registerViewExtension();
    });

    log('loaded.');
  }

  onunload() {
    log('unloaded.');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  registerViewExtension() {
    this.registerView(VIEW_TYPE_VERTICAL_TABS, (leaf) => {
      return new VerticalTabsViewView(leaf);
    });
    this.addCommand({
      id: 'vertical-tabs-view-show',
      name: 'Show vertical tabs view',
      editorCallback: async () => {
        const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_VERTICAL_TABS);
        if (leaves[0]) {
          return this.app.workspace.revealLeaf(leaves[0]);
        }
        const leaf = this.app.workspace.getRightLeaf(false);
        await leaf.setViewState({
          type: VIEW_TYPE_VERTICAL_TABS,
          active: true,
        });
        this.app.workspace.revealLeaf(leaf);
      },
    });
  }
}

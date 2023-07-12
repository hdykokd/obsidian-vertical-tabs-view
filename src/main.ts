import { Plugin } from 'obsidian';
import { log } from './util/message';
import { VerticalTabsViewSettings, DEFAULT_SETTINGS, VerticalTabsViewSettingTab } from './setting';
import { VerticalTabsViewView, VIEW_TYPE_VERTICAL_TABS } from './view';

export default class VerticalTabsView extends Plugin {
  settings: VerticalTabsViewSettings;

  private view: VerticalTabsViewView;

  async onload() {
    log('loading...');
    await this.loadSettings();
    this.addSettingTab(new VerticalTabsViewSettingTab(this.app, this));
    this.addCommands();
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
    const view = this.view;
    if (!view) return;
    view.setSettings(this.settings);
    view.updateView();
  }

  addCommands() {
    this.addCommand({
      id: 'show-tabs-view',
      name: 'Show vertical tabs view',
      callback: async () => {
        this.openViewLeaf();
      },
    });
    this.addCommand({
      id: 'cycle-previous-tab',
      name: 'Cycle previous tab',
      callback: async () => {
        if (!this.view) return;
        this.view.cyclePreviousTab();
      },
    });
    this.addCommand({
      id: 'cycle-next-tab',
      name: 'Cycle next tab',
      callback: async () => {
        if (!this.view) return;
        this.view.cycleNextTab();
      },
    });
  }

  registerViewExtension() {
    this.registerView(VIEW_TYPE_VERTICAL_TABS, (leaf) => {
      this.view = new VerticalTabsViewView(this.settings, leaf);
      return this.view;
    });
  }

  async openViewLeaf() {
    const getLeaf = () => {
      if (this.settings.defaultPosition === 'left') {
        return this.app.workspace.getLeftLeaf(false);
      }
      if (this.settings.defaultPosition === 'right') {
        return this.app.workspace.getRightLeaf(false);
      }
      return this.app.workspace.getLeftLeaf(false);
    };

    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_VERTICAL_TABS);
    if (leaves[0]) {
      return this.app.workspace.revealLeaf(leaves[0]);
    }
    const leaf = getLeaf();
    await leaf.setViewState({
      type: VIEW_TYPE_VERTICAL_TABS,
      active: true,
    });
    this.app.workspace.revealLeaf(leaf);
  }
}

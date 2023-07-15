import { Plugin } from 'obsidian';
import { log } from './util/message';
import { VerticalTabsViewSettings, DEFAULT_SETTINGS, VerticalTabsViewSettingTab } from './setting';
import { VerticalTabsViewView, VIEW_TYPE_VERTICAL_TABS } from './view';

export default class VerticalTabsView extends Plugin {
  settings: VerticalTabsViewSettings;

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

    // migrate
    if (
      this.settings.tabIconRules.length === 0 &&
      'tabIconConfigs' in this.settings &&
      Array.isArray(this.settings.tabIconConfigs) &&
      this.settings.tabIconConfigs.length > 0
    ) {
      this.settings.tabIconRules = structuredClone(this.settings.tabIconConfigs);
      delete this.settings.tabIconConfigs;
      this.saveSettings(this.settings);
    }
  }

  async saveSettings(settings: VerticalTabsViewSettings) {
    await this.saveData(settings);
    this.settings = settings;
    const view = this.getView();
    if (!view) return;
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
        const view = this.getView();
        if (!view) return;
        view.cyclePreviousTab();
      },
    });
    this.addCommand({
      id: 'cycle-next-tab',
      name: 'Cycle next tab',
      callback: async () => {
        const view = this.getView();
        if (!view) return;
        view.cycleNextTab();
      },
    });
  }

  registerViewExtension() {
    this.registerView(VIEW_TYPE_VERTICAL_TABS, (leaf) => {
      return new VerticalTabsViewView(this.settings, leaf);
    });
  }

  getView() {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_VERTICAL_TABS)[0];
    if (!leaf) return;
    return leaf.view as VerticalTabsViewView;
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

    const activeLeaf = this.getView();
    if (activeLeaf) {
      activeLeaf.updateView();
      return this.app.workspace.revealLeaf(activeLeaf.leaf);
    }
    const leaf = getLeaf();
    await leaf.setViewState({
      type: VIEW_TYPE_VERTICAL_TABS,
      active: true,
    });
    this.app.workspace.revealLeaf(leaf);
  }
}

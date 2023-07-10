import { PluginSettingTab, App } from 'obsidian';
import VerticalTabsView from './main';
import { createSelect, createToggle } from './util/setting';

export const DEFAULT_POSITION_OPTIONS = {
  left: 'left',
  right: 'right',
} as const;

// eslint-disable-next-line
export interface VerticalTabsViewSettings {
  defaultPosition: (typeof DEFAULT_POSITION_OPTIONS)[keyof typeof DEFAULT_POSITION_OPTIONS];
  showPinnedIcon: boolean;
  showPinIconIfNotPinned: boolean;
  showTabIcon: boolean;
}

export const DEFAULT_SETTINGS: VerticalTabsViewSettings = {
  defaultPosition: 'left',
  showPinnedIcon: true,
  showPinIconIfNotPinned: true,
  showTabIcon: true,
};

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

    createSelect(
      containerEl,
      'Default Position',
      'Default position of vertical tabs view opened',
      DEFAULT_POSITION_OPTIONS,
      this.plugin.settings.defaultPosition,
      (value: (typeof DEFAULT_POSITION_OPTIONS)[keyof typeof DEFAULT_POSITION_OPTIONS]) => {
        this.plugin.settings.defaultPosition = value;
        this.plugin.saveSettings();
      },
    );
    createToggle(containerEl, 'Show pinned icon', '', this.plugin.settings.showPinnedIcon, (value) => {
      this.plugin.settings.showPinnedIcon = value;
      this.plugin.saveSettings();
    });
    createToggle(
      containerEl,
      'Show pin icon if not pinned',
      '',
      this.plugin.settings.showPinIconIfNotPinned,
      (value) => {
        this.plugin.settings.showPinIconIfNotPinned = value;
        this.plugin.saveSettings();
      },
    );
    createToggle(containerEl, 'Show tab icon', '', this.plugin.settings.showTabIcon, (value) => {
      this.plugin.settings.showTabIcon = value;
      this.plugin.saveSettings();
    });
  }
}

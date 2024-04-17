import { PluginSettingTab, App, Setting, setIcon } from 'obsidian';
import { DEFAULT_POSITION_OPTIONS, DEFAULT_TAB_ICON_CONFIG, TAB_ICON_OPTIONS } from './constants';
import type VerticalTabsView from './main';
import type { TabIconRule } from './types';
import { createSelect, createText, createToggle } from './util/setting';

export interface VerticalTabsViewSettings {
  defaultPosition: (typeof DEFAULT_POSITION_OPTIONS)[keyof typeof DEFAULT_POSITION_OPTIONS];
  showDirectory: boolean;
  showCloseIcon: boolean;
  showPinnedIcon: boolean;
  showPinIconIfNotPinned: boolean;
  showTabIcon: boolean;
  customizeTabIcon: boolean;
  defaultTabIcon: string;
  tabIconRules: TabIconRule[];
  // deprecated
  tabIconConfigs?: TabIconRule[];
}

export const DEFAULT_SETTINGS: VerticalTabsViewSettings = {
  defaultPosition: 'left',
  showDirectory: true,
  showCloseIcon: true,
  showPinnedIcon: true,
  showPinIconIfNotPinned: true,
  showTabIcon: true,
  customizeTabIcon: false,
  defaultTabIcon: 'file',
  tabIconRules: [],
};

export class VerticalTabsViewSettingTab extends PluginSettingTab {
  plugin: VerticalTabsView;
  settings: VerticalTabsViewSettings;

  constructor(app: App, plugin: VerticalTabsView) {
    super(app, plugin);
    this.plugin = plugin;
    this.settings = structuredClone(plugin.settings);
  }

  save() {
    this.plugin.saveSettings(this.settings);
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    createSelect(
      containerEl,
      'Default position',
      'Default position of vertical tabs view opened',
      DEFAULT_POSITION_OPTIONS,
      this.settings.defaultPosition,
      (value: (typeof DEFAULT_POSITION_OPTIONS)[keyof typeof DEFAULT_POSITION_OPTIONS]) => {
        this.settings.defaultPosition = value;
        this.save();
      },
    );
    createToggle(containerEl, 'Show directory', '', this.settings.showDirectory, (value) => {
      this.settings.showDirectory = value;
      this.save();
    });
    createToggle(containerEl, 'Show close icon', '', this.settings.showCloseIcon, (value) => {
      this.settings.showCloseIcon = value;
      this.save();
    });
    createToggle(containerEl, 'Show pinned icon', '', this.settings.showPinnedIcon, (value) => {
      this.settings.showPinnedIcon = value;
      this.save();
    });
    createToggle(containerEl, 'Show pin icon if not pinned', '', this.settings.showPinIconIfNotPinned, (value) => {
      this.settings.showPinIconIfNotPinned = value;
      this.save();
    });

    // tab icon
    createToggle(containerEl, 'Show tab icon', '', this.settings.showTabIcon, (value) => {
      this.settings.showTabIcon = value;
      this.save();
      this.display();
    });

    createToggle(containerEl, 'Customize tab icon', '', this.settings.customizeTabIcon, (value) => {
      this.settings.customizeTabIcon = value;
      this.save();
      this.display();
    });

    // tab icon per condition
    if (this.settings.customizeTabIcon) {
      // default icon
      const { previewIconWrapper, previewIcon, previewIconText } = this.createPreviewIcon(this.settings.defaultTabIcon);

      const defaultTabIcon = createText(
        containerEl,
        'Default tab icon',
        'If you clear this field, icon will be hidden by default.',
        this.settings.defaultTabIcon,
        (value) => {
          this.settings.defaultTabIcon = value;
          this.save();
          setIcon(previewIcon, value);
          if (previewIcon.children.length === 0) {
            // not found
            previewIconText.innerText = 'Not found.';
          } else {
            previewIconText.innerText = 'Preview: ';
          }
        },
      ).setDesc('See https://lucide.dev/icons for available icons.');
      defaultTabIcon.controlEl.prepend(previewIconWrapper);

      new Setting(containerEl).setName('Icon rules for override icon');

      const tabIconRulesEl = containerEl.createEl('div');
      tabIconRulesEl.className = 'vertical-tabs-view-settings-tab-icon-rules';

      if (this.settings.tabIconRules.length === 0) {
        this.settings.tabIconRules.push(structuredClone(DEFAULT_TAB_ICON_CONFIG));
      }

      this.settings.tabIconRules.forEach((c, i) => {
        this.addTabIconRule(tabIconRulesEl, c, i);
      });

      const addBtn = new Setting(tabIconRulesEl).addButton((button) => {
        button.setButtonText('Add').onClick(async () => {
          this.settings.tabIconRules.push(structuredClone(DEFAULT_TAB_ICON_CONFIG));
          this.display();
        });
      });
      addBtn.setClass('vertical-tabs-view-settings-tab-icon-rules-add-btn');
    }
  }

  createPreviewIcon(defaultIcon: string) {
    const previewIconWrapper = document.createElement('div');
    previewIconWrapper.className = 'vertical-tabs-view-settings-tab-preview-icon-wrapper';
    const previewIconText = document.createElement('div');
    previewIconText.className = 'vertical-tabs-view-settings-tab-preview-icon-text';
    previewIconText.innerText = 'Preview: ';
    const previewIcon = document.createElement('div');
    setIcon(previewIcon, defaultIcon);
    if (previewIcon.children.length === 0) {
      // not found
      previewIconText.innerText = 'Icon not found';
    } else {
      previewIconText.innerText = 'Preview: ';
    }
    previewIconWrapper.setChildrenInPlace([previewIconText, previewIcon]);
    return { previewIconWrapper, previewIcon, previewIconText };
  }

  addTabIconRule(parentEl: HTMLElement, config: TabIconRule, index: number) {
    const wrapperEl = parentEl.createEl('div');
    wrapperEl.className = 'vertical-tabs-view-settings-tab-icon-rule-wrapper';

    const matchConfigEl = wrapperEl.createEl('div');
    matchConfigEl.className = 'vertical-tabs-view-settings-tab-icon-rule-match-config-wrapper';

    // target
    new Setting(matchConfigEl)
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(TAB_ICON_OPTIONS.TARGET)
          .setValue(config.matchConfig.target)
          .onChange(async (v: keyof typeof TAB_ICON_OPTIONS.TARGET) => {
            config.matchConfig.target = v;
            this.save();
          });
      })
      .setName('Match target');

    // condition
    new Setting(matchConfigEl)
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(TAB_ICON_OPTIONS.CONDITION)
          .setValue(config.matchConfig.condition)
          .onChange(async (v: keyof typeof TAB_ICON_OPTIONS.CONDITION) => {
            config.matchConfig.condition = v;
            this.save();
          });
      })
      .setName('Match condition');

    // value
    new Setting(matchConfigEl)
      .addText((text) => {
        text.setValue(config.matchConfig.value).onChange((v: string) => {
          config.matchConfig.value = v;
          this.save();
        });
      })
      .setName('Match value')
      .setDesc('For regexp, write like: /foo/i');

    // priority
    new Setting(matchConfigEl)
      .addSlider((slider) => {
        slider
          .setLimits(1, 100, 1)
          .setValue(config.priority)
          .onChange((v) => {
            config.priority = v;
            this.save();
          })
          .setDynamicTooltip();
      })
      .setName('Priority')
      .setDesc('If there are multiple configs with the same priority, the one defined first will be prioritized.');

    // icon
    const { previewIconWrapper, previewIcon, previewIconText } = this.createPreviewIcon(config.icon);
    const iconEl = new Setting(matchConfigEl)
      .addText((text) => {
        text.setValue(config.icon).onChange((v) => {
          config.icon = v;
          this.save();
          setIcon(previewIcon, v);
          if (previewIcon.children.length === 0) {
            // not found
            previewIconText.innerText = 'Icon not found';
          } else {
            previewIconText.innerText = 'Preview: ';
          }
        });
      })
      .setName('Icon')
      .setDesc('See https://lucide.dev/icons for available icons.');

    iconEl.controlEl.prepend(previewIconWrapper);

    // remove icon
    const removeBtnWrapper = wrapperEl.createEl('div');
    removeBtnWrapper.className = 'vertical-tabs-view-settings-tab-icon-rule-remove-btn-wrapper';
    const removeBtn = removeBtnWrapper.createEl('button');
    removeBtn.setText('Remove');
    removeBtn.onclick = () => {
      this.settings.tabIconRules.splice(index, 1);
      this.save();
      this.display();
    };
  }
}

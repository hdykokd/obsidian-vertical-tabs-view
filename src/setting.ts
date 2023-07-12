import { PluginSettingTab, App, Setting, setIcon } from 'obsidian';
import { DEFAULT_POSITION_OPTIONS, DEFAULT_TAB_ICON_CONFIG, TAB_ICON_OPTIONS } from './constants';
import VerticalTabsView from './main';
import { TabIconConfig } from './types';
import { createSelect, createText, createToggle } from './util/setting';

export interface VerticalTabsViewSettings {
  defaultPosition: (typeof DEFAULT_POSITION_OPTIONS)[keyof typeof DEFAULT_POSITION_OPTIONS];
  showPinnedIcon: boolean;
  showPinIconIfNotPinned: boolean;
  showTabIcon: boolean;
  defaultTabIcon: string;
  tabIconConfigs: TabIconConfig[];
}

export const DEFAULT_SETTINGS: VerticalTabsViewSettings = {
  defaultPosition: 'left',
  showPinnedIcon: true,
  showPinIconIfNotPinned: true,
  showTabIcon: true,
  defaultTabIcon: 'file',
  tabIconConfigs: [],
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

    createSelect(
      containerEl,
      'Default position',
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

    // tab icon
    createToggle(containerEl, 'Show tab icon', '', this.plugin.settings.showTabIcon, (value) => {
      this.plugin.settings.showTabIcon = value;
      this.plugin.saveSettings();
      this.display();
    });

    // tab icon per condition
    if (this.plugin.settings.showTabIcon) {
      // default icon
      const { previewIconWrapper, previewIcon, previewIconText } = this.createPreviewIcon(
        this.plugin.settings.defaultTabIcon,
      );

      const defaultTabIcon = createText(
        containerEl,
        'Default tab icon',
        'If you clear this field, icon will be hidden by default.',
        this.plugin.settings.defaultTabIcon,
        (value) => {
          this.plugin.settings.defaultTabIcon = value;
          this.plugin.saveSettings();
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

      const tabIconConfigs = containerEl.createEl('div');
      tabIconConfigs.style.marginLeft = '1em';

      if (this.plugin.settings.tabIconConfigs.length === 0) {
        this.plugin.settings.tabIconConfigs.push(structuredClone(DEFAULT_TAB_ICON_CONFIG));
      }

      this.plugin.settings.tabIconConfigs.forEach((c, i) => {
        this.addTabIconConfig(tabIconConfigs, c, i);
      });

      const addBtn = new Setting(tabIconConfigs).addButton((button) => {
        button.setButtonText('Add').onClick(async () => {
          this.plugin.settings.tabIconConfigs.push(structuredClone(DEFAULT_TAB_ICON_CONFIG));
          this.display();
        });
      });
      addBtn.settingEl.style.border = 'none';
    }
  }

  createPreviewIcon(defaultIcon: string) {
    const previewIconWrapper = document.createElement('div');
    previewIconWrapper.style.display = 'flex';
    const previewIconText = document.createElement('div');
    previewIconText.innerText = 'Preview: ';
    previewIconText.style.marginRight = '0.5em';
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

  addTabIconConfig(parentEl: HTMLElement, config: TabIconConfig, index: number) {
    const wrapperEl = parentEl.createEl('div');
    wrapperEl.style.border = '1px solid var(--background-modifier-border)';
    wrapperEl.style.padding = '1em';
    wrapperEl.style.marginBottom = '0.25em';

    const matchConfigEl = wrapperEl.createEl('div');
    matchConfigEl.style.borderBottom = '1px solid var(--background-modifier-border)';
    matchConfigEl.style.padding = '0.5em 1em';

    // target
    new Setting(matchConfigEl)
      .addDropdown((dropdown) => {
        dropdown
          .setValue(config.matchConfig.target)
          .addOptions(TAB_ICON_OPTIONS.TARGET)
          .onChange(async (v: keyof typeof TAB_ICON_OPTIONS.TARGET) => {
            config.matchConfig.target = v;
            this.plugin.saveSettings();
          });
      })
      .setName('Match target');

    // condition
    new Setting(matchConfigEl)
      .addDropdown((dropdown) => {
        dropdown
          .setValue(config.matchConfig.condition)
          .addOptions(TAB_ICON_OPTIONS.CONDITION)
          .onChange(async (v: keyof typeof TAB_ICON_OPTIONS.CONDITION) => {
            config.matchConfig.condition = v;
            this.plugin.saveSettings();
          });
      })
      .setName('Match condition');

    // value
    new Setting(matchConfigEl)
      .addText((text) => {
        text.setValue(config.matchConfig.value).onChange((v: string) => {
          config.matchConfig.value = v;
          this.plugin.saveSettings();
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
            this.plugin.saveSettings();
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
          this.plugin.saveSettings();
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
    removeBtnWrapper.style.display = 'flex';
    removeBtnWrapper.style.justifyContent = 'end';
    removeBtnWrapper.style.marginTop = '1em';
    const removeBtn = removeBtnWrapper.createEl('button');
    removeBtn.setText('Remove');
    removeBtn.onclick = () => {
      this.plugin.settings.tabIconConfigs.splice(index, 1);
      this.plugin.saveSettings();
      this.display();
    };
  }
}

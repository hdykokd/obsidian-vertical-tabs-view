import { Plugin, PluginSettingTab, Setting } from 'obsidian';
import { log } from './util/message';
import { MyPluginSettings, DEFAULT_SETTINGS, MyPluginSettingTab } from './setting';

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;

  async onload() {
    log('loading...');
    await this.loadSettings();
    this.addSettingTab(new MyPluginSettingTab(this.app, this));
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
}

import { Setting } from 'obsidian';

export const createText = (
  containerEl: HTMLElement,
  name: string,
  desc: string,
  initialValue: string,
  onChange: (value: string) => void,
) => {
  return new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addText((text) => text.setValue(initialValue).onChange(onChange));
};

export const createToggle = (
  containerEl: HTMLElement,
  name: string,
  desc: string,
  initialValue: boolean,
  onChange: (value: boolean) => void,
) => {
  return new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addToggle((toggle) => toggle.setValue(initialValue).onChange(onChange));
};

export const createSelect = (
  containerEl: HTMLElement,
  name: string,
  desc: string,
  options: Record<string, string>,
  initialValue: string,
  onChange: (value: string) => void,
) => {
  return new Setting(containerEl)
    .setName(name)
    .setDesc(desc)
    .addDropdown((dropdown) => {
      dropdown.addOptions(options).setValue(initialValue).onChange(onChange);
    });
};

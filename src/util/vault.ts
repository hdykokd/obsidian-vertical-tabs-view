import type { App } from 'obsidian';

export const getAbstractFile = (app: App, path: string) => {
  return app.vault.getAbstractFileByPath(path);
};

export const trashVaultFile = async (app: App, path: string, system: boolean) => {
  const file = getAbstractFile(app, path);
  if (!file) return;
  return await app.vault.trash(file, system);
};

export const deleteVaultFile = async (app: App, path: string) => {
  const file = getAbstractFile(app, path);
  if (!file) return;
  return await app.vault.delete(file);
};

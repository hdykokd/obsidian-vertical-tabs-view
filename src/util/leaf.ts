import { App } from 'obsidian';

export const setActiveLeafById = (app: App, id: string) => {
  const newLeaf = app.workspace.getLeafById(id);
  if (!newLeaf) return;
  app.workspace.setActiveLeaf(newLeaf);
};

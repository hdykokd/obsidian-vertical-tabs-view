import type { App, WorkspaceLeaf } from 'obsidian';

export const setActiveLeaf = async (app: App, leaf: WorkspaceLeaf) => {
  app.workspace.setActiveLeaf(leaf, { focus: true });
};

export const setActiveLeafById = async (app: App, id: string) => {
  const leaf = app.workspace.getLeafById(id);
  if (!leaf) return;
  await setActiveLeaf(app, leaf);
  return leaf;
};

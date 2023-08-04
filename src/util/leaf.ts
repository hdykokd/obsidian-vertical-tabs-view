import { App, WorkspaceLeaf } from 'obsidian';

export const setActiveLeaf = async (app: App, leaf: WorkspaceLeaf) => {
  app.workspace.setActiveLeaf(leaf, { focus: true });
  return new Promise((resolve) => {
    setTimeout(() => {
      leaf.setEphemeralState(leaf.getEphemeralState());
      resolve(null);
    }, 50);
  });
};

export const setActiveLeafById = async (app: App, id: string) => {
  const leaf = app.workspace.getLeafById(id);
  if (!leaf) return;
  await setActiveLeaf(app, leaf);
};

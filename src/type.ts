import { WorkspaceLeaf } from 'obsidian';

export type Leaf = WorkspaceLeaf & {
  id: string;
  pinned: boolean;
  tabHeaderEl: HTMLElement;
};

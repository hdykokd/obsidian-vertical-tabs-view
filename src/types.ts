import type { WorkspaceLeaf } from 'obsidian';
import type { TAB_ICON_OPTIONS } from './constants';

export type Leaf = WorkspaceLeaf & { id: string; pinned: boolean };

export type TabIconRule = {
  matchConfig: {
    target: keyof (typeof TAB_ICON_OPTIONS)['TARGET'];
    condition: keyof (typeof TAB_ICON_OPTIONS)['CONDITION'];
    value: string;
  };
  priority: number;
  icon: string;
};

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { VerticalTabsViewSettings } from './setting';
import { setActiveLeafById } from './util/leaf';
import Tabs from './components/Tabs.svelte';

import type VerticalTabsView from './main';
import store from './store';

const VIEW_PREFIX = 'vertical-tabs-view';
const VIEW_CONTENT_ID = VIEW_PREFIX + '-content';
const STORAGE_KEY = {
  LIST_STATE: VIEW_PREFIX + 'list-state',
} as const;

export const VIEW_TYPE_VERTICAL_TABS = 'vertical-tabs-view';

type LayoutNode = {
  id: string;
  type: 'leaf' | 'tabs';
  children?: LayoutNode[];
};

type Leaf = WorkspaceLeaf & { id: string; pinned: boolean };

export class VerticalTabsViewView extends ItemView {
  plugin: VerticalTabsView;
  Tabs: Tabs;

  settings: VerticalTabsViewSettings;

  state: {
    tabIdToIndex: {
      [id: string]: number;
    };
    sortedTabIds: string[];
  } = {
    tabIdToIndex: {},
    sortedTabIds: [],
  };

  constructor(plugin: VerticalTabsView, leaf: WorkspaceLeaf) {
    super(leaf);
    this.plugin = plugin;
    this.settings = plugin.settings;

    const savedState = localStorage.getItem(STORAGE_KEY.LIST_STATE);
    if (savedState) {
      try {
        this.state = JSON.parse(savedState);
      } catch (e) {
        console.error(e);
      }
    }

    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.updateView();
      }),
    );
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!leaf) return;
        const state = leaf.getViewState();
        if (state.type === VIEW_TYPE_VERTICAL_TABS) return;
        this.updateView();
      }),
    );
  }
  setSettings(settings: VerticalTabsViewSettings) {
    this.plugin.settings = settings;
    store.plugin.set(this.plugin);
    this.updateView();
  }

  getViewType() {
    return VIEW_TYPE_VERTICAL_TABS;
  }
  getIcon() {
    return 'list';
  }
  getDisplayText() {
    return 'Vertical Tabs';
  }
  async onClose() {
    this.Tabs.$destroy();
  }
  async onOpen() {
    store.plugin.set(this.plugin as VerticalTabsView);
    store.leaves.set(this.getSortedLeaves());
    store.activeLeafId.set(this.getActiveLeaf().id);

    const el = this.contentEl;
    el.id = VIEW_CONTENT_ID;

    this.Tabs = new Tabs({
      target: this.contentEl,
      props: {
        view: this,
        state: this.state,
        updateView: this.updateView,
        viewContentId: VIEW_CONTENT_ID,
      },
    });
  }

  getActiveLeaf() {
    const activeLeaf = this.app.workspace.getMostRecentLeaf() as Leaf;
    return activeLeaf;
  }

  async setActiveLeafById(id: string) {
    await setActiveLeafById(this.app, id);
    store.activeLeafId.set(id);
  }

  updateView() {
    store.activeLeafId.set(this.getActiveLeaf().id);
    store.leaves.set(this.getSortedLeaves());
  }

  private getActiveLeafIndex() {
    const activeLeaf = this.getActiveLeaf();
    if (!activeLeaf) return 0;
    return this.state.tabIdToIndex[activeLeaf.id];
  }

  async cycleNextTab() {
    const currentTabIndex = this.getActiveLeafIndex();
    if (currentTabIndex == null) return;
    const newTabIndex = (currentTabIndex + 1) % this.state.sortedTabIds.length;
    await this.setActiveLeafById(this.state.sortedTabIds[newTabIndex]);
  }
  async cyclePreviousTab() {
    const currentTabIndex = this.getActiveLeafIndex();
    if (currentTabIndex == null) return;
    let newTabIndex = (currentTabIndex - 1) % this.state.sortedTabIds.length;
    if (newTabIndex < 0) {
      newTabIndex += this.state.sortedTabIds.length;
    }
    await this.setActiveLeafById(this.state.sortedTabIds[newTabIndex]);
  }

  private collectLeafIds(nodes: LayoutNode[], leaveIds: string[] = []) {
    nodes.forEach((node) => {
      if (node.type === 'leaf') {
        leaveIds.push(node.id);
      } else if ('children' in node && Array.isArray(node.children)) {
        return this.collectLeafIds(node.children, leaveIds);
      }
    });
    return leaveIds;
  }

  private getLeaves() {
    const leaves: Leaf[] = [];

    const root = this.app.workspace.rootSplit;
    // @ts-expect-error
    const leaveIdsInMain = this.collectLeafIds(root.children);

    this.app.workspace.iterateRootLeaves((leaf: Leaf) => {
      if (!leaveIdsInMain.includes(leaf.id)) return;
      leaves.push(leaf);
    });
    return leaves;
  }

  private getSortedLeaves() {
    return this.getLeaves()
      .slice()
      .sort((a, b) => {
        const aPos = this.state.tabIdToIndex[a.id] ?? Infinity;
        const bPos = this.state.tabIdToIndex[b.id] ?? Infinity;
        return aPos - bPos;
      });
  }
}

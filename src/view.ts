import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { VerticalTabsViewSettings } from './setting';
import type { TabIconRule } from './types';
import { setActiveLeaf, setActiveLeafById } from './util/leaf';
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
  tabIconRules: TabIconRule[];

  regexCompileCache: Record<string, RegExp> = {};

  state: {
    tabIdToIndex: {
      [id: string]: number;
    };
    sortedTabIds: string[];
  } = {
    tabIdToIndex: {},
    sortedTabIds: [],
  };

  constructor(plugin: VerticalTabsView, settings: VerticalTabsViewSettings, leaf: WorkspaceLeaf) {
    super(leaf);
    this.plugin = plugin;
    this.setSettings(settings);

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
    this.settings = settings;
    store.settings.set(this.settings);
    this.tabIconRules = settings.tabIconRules.sort((a, b) => b.priority - a.priority);
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
    this.contentEl.empty();
    // this.Tabs.$destroy();
  }
  async onOpen() {
    store.plugin.set(this.plugin as VerticalTabsView);
    store.settings.set(this.settings);
    store.leaves.set(this.getSortedLeaves());
    store.activeLeafId.set(this.getActiveLeaf().id);

    const el = this.contentEl;
    el.id = VIEW_CONTENT_ID;
    this.Tabs = new Tabs({
      target: this.contentEl,
      props: {
        view: this,
        state: this.state,
        setActiveLeaf: this.setActiveLeaf,
        updateView: this.updateView,
        viewContentId: VIEW_CONTENT_ID,
      },
    });
    // this.updateView();
  }

  getActiveLeaf() {
    const activeLeaf = this.app.workspace.getMostRecentLeaf() as Leaf;
    return activeLeaf;
  }

  async setActiveLeaf(leaf: Leaf) {
    await setActiveLeaf(this.app, leaf);
    store.activeLeafId.set(leaf.id);
  }
  async setActiveLeafById(id: string) {
    await setActiveLeafById(this.app, id);
    store.activeLeafId.set(id);
  }

  updateView() {
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

import { ItemView, setIcon, WorkspaceLeaf } from 'obsidian';
import { VerticalTabsViewSettings } from './setting';
import { TabIconConfig } from './types';
import { getMatchedTabIconConfig } from './util/view';
import Sortable, { type SortableEvent } from 'sortablejs';
import { setActiveLeafById } from './util/leaf';

const VIEW_PREFIX = 'vertical-tabs-view';
const VIEW_CONTENT_ID = VIEW_PREFIX + '-content';
const VIEW_LIST_ID = VIEW_PREFIX + '-list';
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
  settings: VerticalTabsViewSettings;
  tabIconConfigs: TabIconConfig[];

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

  constructor(settings: VerticalTabsViewSettings, leaf: WorkspaceLeaf) {
    super(leaf);
    this.setSettings(settings);

    const savedState = localStorage.getItem(STORAGE_KEY.LIST_STATE);
    if (savedState) {
      this.state = JSON.parse(savedState);
    }

    this.updateView();

    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.updateView();
      }),
    );
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (leaf) => {
        if (!leaf) return;
        const state = leaf.getViewState();
        if (state.type === VIEW_TYPE_VERTICAL_TABS && document.querySelector(`#${VIEW_CONTENT_ID}`)) return;
        this.updateView();
      }),
    );
  }
  setSettings(settings: VerticalTabsViewSettings) {
    this.settings = settings;
    this.tabIconConfigs = settings.tabIconConfigs.sort((a, b) => b.priority - a.priority);
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
    this.containerEl.empty();
  }
  async onOpen() {
    const el = this.contentEl;
    el.id = VIEW_CONTENT_ID;
    const ul = this.createListEl();
    ul.id = VIEW_LIST_ID;
    el.appendChild(ul);

    this.updateView();
  }
  private getActiveLeafIndex() {
    const leaf = this.app.workspace.getMostRecentLeaf() as Leaf;
    if (!leaf) return;
    return this.state.tabIdToIndex[leaf.id];
  }
  cycleNextTab() {
    const currentTabIndex = this.getActiveLeafIndex();
    if (currentTabIndex == null) return;
    const newTabIndex = (currentTabIndex + 1) % this.state.sortedTabIds.length;
    setActiveLeafById(this.app, this.state.sortedTabIds[newTabIndex]);
  }
  cyclePreviousTab() {
    const currentTabIndex = this.getActiveLeafIndex();
    if (currentTabIndex == null) return;
    let newTabIndex = (currentTabIndex - 1) % this.state.sortedTabIds.length;
    if (newTabIndex < 0) {
      newTabIndex += this.state.sortedTabIds.length;
    }
    setActiveLeafById(this.app, this.state.sortedTabIds[newTabIndex]);
  }

  collectLeafIds(nodes: LayoutNode[], leaveIds: string[] = []) {
    nodes.forEach((node) => {
      if (node.type === 'leaf') {
        leaveIds.push(node.id);
      } else if ('children' in node && Array.isArray(node.children)) {
        return this.collectLeafIds(node.children, leaveIds);
      }
    });
    return leaveIds;
  }

  updateView() {
    const el = document.querySelector(`#${VIEW_CONTENT_ID}`);
    const ul = document.querySelector(`#${VIEW_LIST_ID}`);
    if (!el || !ul) return;

    const layout = this.app.workspace.getLayout();
    const leaveIdsInMain = this.collectLeafIds(layout.main.children);

    // @ts-expect-error
    const viewTypes = Object.keys(this.app.viewRegistry.viewByType);
    // detect empty(new) tab
    viewTypes.push('empty');

    const leaves = viewTypes
      .map((t: string) => this.app.workspace.getLeavesOfType(t))
      .flat()
      .filter((l: Leaf) => {
        return leaveIdsInMain.includes(l.id);
      })
      .sort((a: Leaf, b: Leaf) => {
        const aPos = this.state.tabIdToIndex[a.id] ?? Infinity;
        const bPos = this.state.tabIdToIndex[b.id] ?? Infinity;
        return aPos - bPos;
      });

    const activeLeaf = this.app.workspace.getMostRecentLeaf();

    const listItems: Node[] = [];

    // initialize
    this.state.tabIdToIndex = {};
    this.state.sortedTabIds = [];

    leaves.forEach((l: Leaf, index) => {
      this.state.tabIdToIndex[l.id] = index;
      this.state.sortedTabIds.push(l.id);
      listItems.push(this.createListItemEl(l, activeLeaf as Leaf));
    });
    ul.setChildrenInPlace(listItems);
    localStorage.setItem(STORAGE_KEY.LIST_STATE, JSON.stringify(this.state));
  }

  // ---- UI
  private createListEl() {
    const ul = document.createElement('ul');
    ul.className = 'vertical-tabs-view-list';
    Sortable.create(ul, {
      group: 'vertical-tabs-view-list',
      direction: 'vertical',
      ghostClass: 'vertical-tabs-view-list-item-ghost',
      animation: 200,
      touchStartThreshold: 3,
      onEnd: (ev: SortableEvent) => {
        if (ev.oldIndex == null || ev.newIndex == null) return;
        const start = Math.min(ev.oldIndex, ev.newIndex);
        const end = Math.max(ev.oldIndex, ev.newIndex);

        for (let i = start; i <= end; i++) {
          const item = ul.children[i];
          const leafId = item.getAttribute('data-leaf-id');
          if (leafId) {
            this.state.tabIdToIndex[leafId] = i;
            this.state.sortedTabIds[i] = leafId;
          }
        }
        this.updateView();
      },
    });
    return ul;
  }

  private createListItemEl(leaf: Leaf, activeLeaf?: Leaf) {
    const listItem = document.createElement('li');
    listItem.dataset.leafId = leaf.id;

    listItem.className = 'vertical-tabs-view-list-item';
    if (activeLeaf && activeLeaf.id === leaf.id) {
      listItem.className += ' focused';
    }
    listItem.onclick = () => {
      this.app.workspace.setActiveLeaf(leaf);
    };

    const listItemLeftContainer = document.createElement('div');
    listItemLeftContainer.className = 'vertical-tabs-view-list-item-left-container';
    listItemLeftContainer.setChildrenInPlace([]);
    const listItemRightContainer = document.createElement('div');
    listItemRightContainer.className = 'vertical-tabs-view-list-item-right-container';
    listItemRightContainer.setChildrenInPlace([]);

    // close button
    const closeBtn = document.createElement('div');
    closeBtn.className = 'vertical-tabs-view-list-item-close-btn vertical-tabs-view-list-item-icon';
    setIcon(closeBtn, 'x');
    closeBtn.onclick = () => {
      leaf.detach();
    };

    const listItemNameContainer = document.createElement('div');
    listItemNameContainer.className = 'vertical-tabs-view-list-item-name-container';

    // @ts-expect-error
    const file = leaf.view.file;

    // dir
    const dirname = file ? file.parent.path : '';
    if (dirname) {
      const dirnameEl = document.createElement('span');
      dirnameEl.className = 'vertical-tabs-view-list-item-dirname';
      dirnameEl.innerText = dirname;
      listItemNameContainer.appendChild(dirnameEl);
    }

    // title
    // @ts-expect-error
    const title = leaf.tabHeaderEl.innerText;
    const titleEl = document.createElement('span');
    titleEl.className = 'vertical-tabs-view-list-item-title';
    titleEl.innerText = title;
    listItemNameContainer.appendChild(titleEl);

    listItemLeftContainer.setChildrenInPlace(
      [
        closeBtn,
        // @ts-expect-error
        this.settings.showTabIcon ? this.createTabIconEl(leaf, dirname, title) : null,
        listItemNameContainer,
      ].filter((v) => v) as Node[],
    );

    // pin button
    const pinned = leaf.pinned;
    if (this.settings.showPinnedIcon && pinned) {
      const pinnedBtn = this.createPinIconEl('pin', () => {
        leaf.setPinned(false);
      });
      listItemRightContainer.appendChild(pinnedBtn);
    }
    if (this.settings.showPinIconIfNotPinned && !pinned) {
      const pinnedBtn = this.createPinIconEl('pin-off', () => {
        leaf.setPinned(true);
      });
      listItemRightContainer.appendChild(pinnedBtn);
    }

    listItem.setChildrenInPlace([listItemLeftContainer, listItemRightContainer]);
    return listItem;
  }

  private createTabIconEl(
    leaf: WorkspaceLeaf & { tabHeaderInnerIconEl: HTMLElement },
    dirname: string,
    title: string,
  ): HTMLElement {
    const icon = leaf.tabHeaderInnerIconEl.cloneNode(true) as HTMLElement;
    icon.className = 'vertical-tabs-view-list-item-tab-icon vertical-tabs-view-list-item-icon';
    const matchedConfig = getMatchedTabIconConfig(this.tabIconConfigs, dirname, title, this.regexCompileCache);
    if (matchedConfig) {
      // override
      setIcon(icon, matchedConfig.icon);
    } else if (this.settings.defaultTabIcon) {
      // set default
      setIcon(icon, this.settings.defaultTabIcon);
    } else if (leaf.getViewState().type === 'markdown') {
      // remove
      setIcon(icon, '');
    }
    return icon;
  }

  private createPinIconEl(icon: 'pin' | 'pin-off', onClick: GlobalEventHandlers['onclick']) {
    const pinBtn = document.createElement('div');
    pinBtn.className = `vertical-tabs-view-list-item-icon vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-${icon}`;
    setIcon(pinBtn, icon);
    pinBtn.onclick = onClick;
    return pinBtn;
  }
}

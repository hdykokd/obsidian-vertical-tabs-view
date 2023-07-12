import { ItemView, setIcon, WorkspaceLeaf } from 'obsidian';
import { VerticalTabsViewSettings } from './setting';
import { TabIconConfig } from './types';
import { getMatchedTabIconConfig } from './util/view';
import Sortable from 'sortablejs';

const VIEW_PREFIX = 'vertical-tabs-view';
const VIEW_CONTENT_ID = VIEW_PREFIX + '-content';
const STORAGE_KEY = {
  LIST_SORT_ORDER: VIEW_PREFIX + 'list-sort-order',
} as const;

export const VIEW_TYPE_VERTICAL_TABS = 'view-type-vertical-tabs-view';

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
    tabs: {
      [id: string]: number;
    };
  } = {
    tabs: {},
  };

  constructor(settings: VerticalTabsViewSettings, leaf: WorkspaceLeaf) {
    super(leaf);
    this.setSettings(settings);
    this.state.tabs = JSON.parse(localStorage.getItem(STORAGE_KEY.LIST_SORT_ORDER) || '{}');

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
    this.updateView();
  }
  updateView() {
    const el = document.querySelector(`#${VIEW_CONTENT_ID}`);
    if (!el) return;
    el.setChildrenInPlace([]);

    const walk = (nodes: LayoutNode[], leaveIds: string[] = []) => {
      nodes.forEach((node) => {
        if (node.type === 'leaf') {
          leaveIds.push(node.id);
        } else if ('children' in node && Array.isArray(node.children)) {
          return walk(node.children, leaveIds);
        }
      });
      return leaveIds;
    };

    const layout = this.app.workspace.getLayout();
    const leaveIdsInMain: string[] = walk(layout.main.children, []);

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
        const aPos = this.state.tabs[a.id] ?? Infinity;
        const bPos = this.state.tabs[b.id] ?? Infinity;
        return aPos - bPos;
      });

    // initialize
    this.state.tabs = {};
    leaves.forEach((l: Leaf, index) => {
      this.state.tabs[l.id] = index;
    });
    localStorage.setItem(STORAGE_KEY.LIST_SORT_ORDER, JSON.stringify(this.state.tabs));

    const ul = this.createTabsListEl(leaves);
    el.appendChild(ul);
  }

  // ---- UI
  createTabsListEl(leaves: WorkspaceLeaf[]) {
    const ul = document.createElement('ul');
    ul.className = 'vertical-tabs-view-list';
    Sortable.create(ul, {
      group: 'vertical-tabs-view-list',
      direction: 'vertical',
      ghostClass: 'vertical-tabs-view-list-item-ghost',
      animation: 200,
      touchStartThreshold: 3,
      onEnd: (ev: Event & { oldIndex: number; newIndex: number }) => {
        const start = Math.min(ev.oldIndex, ev.newIndex);
        const end = Math.max(ev.oldIndex, ev.newIndex);

        for (let i = start; i <= end; i++) {
          const item = ul.children[i];
          const leafId = item.getAttribute('data-leaf-id');
          if (leafId) {
            this.state.tabs[leafId] = i;
          }
        }
        this.updateView();
      },
    });

    const activeLeaf = this.app.workspace.getMostRecentLeaf();

    leaves.forEach((leaf: Leaf) => {
      const listItem = document.createElement('li');
      listItem.dataset.leafId = leaf.id;

      listItem.className = 'vertical-tabs-view-list-item';
      if (activeLeaf && (activeLeaf as Leaf).id === leaf.id) {
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

      ul.appendChild(listItem);
    });
    return ul;
  }

  createTabIconEl(
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

  createPinIconEl(icon: 'pin' | 'pin-off', onClick: GlobalEventHandlers['onclick']) {
    const pinBtn = document.createElement('div');
    pinBtn.className = `.vertical-tabs-view-list-item-tab-icon vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-${icon}`;
    setIcon(pinBtn, icon);
    pinBtn.onclick = onClick;
    return pinBtn;
  }
}

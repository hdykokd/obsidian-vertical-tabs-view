import { ItemView, setIcon } from 'obsidian';
import VerticalTabsView from './main';
import { Leaf } from './type';

const VIEW_PREFIX = 'vertical-tabs-view';
const VIEW_CONTAINER_ID = VIEW_PREFIX + '-container';
const VIEW_CONTENT_ID = VIEW_PREFIX + '-content';

export const VIEW_TYPE_VERTICAL_TABS = 'view-type-vertical-tabs-view';

export class VerticalTabsViewView extends ItemView {
  plugin: VerticalTabsView;

  constructor(plugin: VerticalTabsView, leaf: Leaf) {
    super(leaf);
    this.plugin = plugin;

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
        if (state.type === VIEW_TYPE_VERTICAL_TABS) return;
        this.updateView();
      }),
    );
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

    const messageContainer = document.createElement('div');
    messageContainer.id = VIEW_CONTAINER_ID;

    this.updateView();
  }

  updateView() {
    const el = document.querySelector(`#${VIEW_CONTENT_ID}`);
    if (!el) return;
    el.setChildrenInPlace([]);

    const ul = document.createElement('ul');
    ul.className = 'vertical-tabs-view-list';

    const walk = (nodes: any[], leaves: any[] = []) => {
      nodes.forEach((node) => {
        if (node.type === 'leaf') {
          leaves.push(node.id);
        } else if (node.type === 'tabs' && 'children' in node) {
          return walk((node as any).children, leaves);
        }
      });
      return leaves;
    };

    const layout = this.app.workspace.getLayout();
    const leavesInMain: string[] = walk(layout.main.children, []);
    // @ts-expect-error
    const viewTypes = Object.keys(this.app.viewRegistry.viewByType);
    const leaves = viewTypes
      .map((t: string) => this.app.workspace.getLeavesOfType(t))
      .flat()
      .filter((l: Leaf) => leavesInMain.includes(l.id));

    const createPinIcon = (icon: 'pin' | 'pin-off', onClick: GlobalEventHandlers['onclick']) => {
      const pinBtn = document.createElement('div');
      pinBtn.className = `vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-${icon}`;
      setIcon(pinBtn, icon);
      pinBtn.onclick = onClick;
      return pinBtn;
    };

    const activeLeaf = this.app.workspace.getMostRecentLeaf();

    leaves.forEach((leaf: Leaf) => {
      const listItem = document.createElement('li');
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
      closeBtn.className = 'vertical-tabs-view-list-item-close-btn';
      setIcon(closeBtn, 'x');
      closeBtn.onclick = () => {
        leaf.detach();
      };

      const listItemNameContainer = document.createElement('div');
      listItemNameContainer.className = 'vertical-tabs-view-list-item-name-container';

      // @ts-expect-error
      const file = leaf.view.file;
      const dirname = file ? file.parent.path : '';
      const title = leaf.tabHeaderEl.innerText;

      // dir
      if (dirname) {
        const dirnameEl = document.createElement('span');
        dirnameEl.className = 'vertical-tabs-view-list-item-dirname';
        dirnameEl.innerText = dirname;
        listItemNameContainer.appendChild(dirnameEl);
      }

      // title
      const titleEl = document.createElement('span');
      titleEl.className = 'vertical-tabs-view-list-item-title';
      titleEl.innerText = title;
      listItemNameContainer.appendChild(titleEl);

      listItemLeftContainer.setChildrenInPlace([closeBtn, listItemNameContainer]);

      // pin button
      // @ts-expect-error
      const pinned = leaf.pinned;
      if (this.plugin.settings.showPinnedIcon && pinned) {
        const pinnedBtn = createPinIcon('pin', () => {
          leaf.setPinned(false);
        });
        listItemRightContainer.appendChild(pinnedBtn);
      }
      if (this.plugin.settings.showPinIconIfNotPinned && !pinned) {
        const pinnedBtn = createPinIcon('pin-off', () => {
          leaf.setPinned(true);
        });
        listItemRightContainer.appendChild(pinnedBtn);
      }

      listItem.setChildrenInPlace([listItemLeftContainer, listItemRightContainer]);

      ul.appendChild(listItem);
    });

    el.appendChild(ul);
  }
}

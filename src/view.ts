import { ItemView, setIcon, WorkspaceLeaf } from 'obsidian';

const VIEW_PREFIX = 'vertical-tabs-view';
const VIEW_CONTAINER_ID = VIEW_PREFIX + '-container';
const VIEW_CONTENT_ID = VIEW_PREFIX + '-content';

export const VIEW_TYPE_VERTICAL_TABS = 'view-type-vertical-tabs-view';

export class VerticalTabsViewView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);

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
        if (state.type !== 'markdown') return;
        this.updateView();
      }),
    );
  }

  getViewType() {
    return VIEW_TYPE_VERTICAL_TABS;
  }

  getIcon() {
    // FIXME
    return 'file-type';
  }

  getDisplayText() {
    return 'vertical tabs view';
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

    const leaves = this.app.workspace.getLeavesOfType('markdown');

    leaves.forEach((leaf) => {
      const listItem = document.createElement('li');
      listItem.className = 'vertical-tabs-view-list-item';
      const activeLeaf = this.app.workspace.getMostRecentLeaf();
      // @ts-expect-error
      if (activeLeaf && activeLeaf.id === leaf.id) {
        listItem.className += ' focused';
      }
      listItem.onclick = () => {
        this.app.workspace.setActiveLeaf(leaf);
      };

      // close button
      const closeBtn = document.createElement('div');
      closeBtn.className = 'vertical-tabs-view-list-item-close-btn';
      setIcon(closeBtn, 'x');
      closeBtn.onclick = () => {
        leaf.detach();
      };
      listItem.appendChild(closeBtn);

      const listItemNameContainer = document.createElement('div');
      listItemNameContainer.className = 'vertical-tabs-view-list-item-name-container';

      const dirname = document.createElement('span');
      dirname.className = 'vertical-tabs-view-list-item-dirname';
      // @ts-expect-error
      dirname.innerText = leaf.view.file.parent.path;
      const title = document.createElement('span');
      title.className = 'vertical-tabs-view-list-item-title';
      // @ts-expect-error
      title.innerText = leaf.view.file.name.split('.').slice(0, -1);
      listItemNameContainer.setChildrenInPlace([dirname, title]);

      listItem.appendChild(listItemNameContainer);

      // if (leaf.pinned) {
      //   const pinBtn = document.createElement('div');
      //   pinBtn.className = 'vertical-tabs-view-list-item-pin-btn';
      //   setIcon(pinBtn, 'pin');
      //   listItem.appendChild(pinBtn);
      // }

      ul.appendChild(listItem);
    });

    el.appendChild(ul);
  }
}

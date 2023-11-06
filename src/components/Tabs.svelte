<script lang="ts">
  import { onMount } from 'svelte';
  import { Menu, Platform, setIcon } from 'obsidian';
  import Sortable, { type SortableEvent } from 'sortablejs';
  import { X, Pin, PinOff } from 'lucide-svelte';
  import store from '../store';
  import type VerticalTabsView from '../main';
  import type { Leaf, TabIconRule } from '../types';
  import type { VerticalTabsViewView } from '../view';
  import { getMatchedTabIconConfig } from '../util/view';
  import { setActiveLeaf } from '../util/leaf';
  import { trashVaultFile, deleteVaultFile } from '../util/vault';

  const VIEW_PREFIX = 'vertical-tabs-view';
  const VIEW_LIST_ITEM_TAB_ICON_CLASS = VIEW_PREFIX + '-list-item-tab-icon';
  const STORAGE_KEY = {
    LIST_STATE: VIEW_PREFIX + 'list-state',
  } as const;

  let plugin: VerticalTabsView;
  let leaves: Leaf[];
  let activeLeafId: string;
  store.plugin.subscribe((v) => {
    plugin = v;
  });
  store.leaves.subscribe((v) => {
    leaves = v;
  });
  store.activeLeafId.subscribe((v) => {
    activeLeafId = v;
  });

  export let view: VerticalTabsViewView;
  export let state: {
    tabIdToIndex: {
      [id: string]: number;
    };
    sortedTabIds: string[];
  } = {
    tabIdToIndex: {},
    sortedTabIds: [],
  };

  let list: HTMLElement;

  export let viewContentId: string;
  export let updateView: Function;
  let tabIconRules: TabIconRule[] = [];

  const getTabIconRules = () => {
    return plugin.settings.tabIconRules.sort((a, b) => b.priority - a.priority);
  };
  $: tabIconRules = getTabIconRules();

  const regexCompileCache: Record<string, RegExp> = {};

  const getDirname = (leaf: Leaf) => {
    // @ts-expect-error
    const file = leaf.view.file;
    return file ? file.parent.path : '';
  };

  const getFilename = (leaf: Leaf) => {
    // @ts-expect-error
    const file = leaf.view.file;

    // title
    // @ts-expect-error
    const viewTitleEls = (leaf.view.titleContainerEl as HTMLElement).querySelectorAll(
      // @ts-expect-error
      `.${(leaf.view.titleEl as HTMLElement).className}`,
    );
    const viewTitleEl = Array.from(viewTitleEls).find((el) => {
      // A workaround for the issue where pinning resets the title
      // modifications made by the "obsidian-front-matter-title" plugin.
      // https://github.com/snezhig/obsidian-front-matter-title/issues/149
      if (el.hasAttribute('hidden')) return;
      return el;
    });
    return viewTitleEl?.getText() || file.name;
  };

  const handleMouseDown = async (ev: MouseEvent, leaf: Leaf) => {
    ev.stopPropagation();

    if (ev.button === 2) {
      return; // right click
    }
    if (ev.target instanceof SVGElement) {
      return; // icon
    }
    await setActiveLeaf(plugin.app, leaf);
    activeLeafId = leaf.id;

    if ((plugin.app as unknown as { isMobile: boolean }).isMobile) {
      if (!plugin.app.workspace.leftSplit?.collapsed) {
        plugin.app.workspace.leftSplit.collapse();
      }
      if (!plugin.app.workspace.rightSplit?.collapsed) {
        plugin.app.workspace.rightSplit.collapse();
      }
    }
  };
  const handleClickClose = (ev: MouseEvent, leaf: Leaf) => {
    leaf.detach();

    if (leaf.id === activeLeafId) {
      if (leaf.id === leaves[0].id && leaves[1]) {
        activeLeafId = leaves[1].id;
      } else if (leaf.id === leaves.at(-1)?.id && leaves.at(-2)) {
        activeLeafId = leaves.at(-2)!.id;
      } else {
        const index = state.tabIdToIndex[leaf.id];
        if (leaves[index - 1]) {
          activeLeafId = leaves[index - 1].id;
        }
      }
    }
  };
  const handleClickCloseOthers = (ev: MouseEvent, leaf: Leaf) => {
    leaves.forEach((l) => {
      if (l.id === leaf.id) return;
      l.detach();
    });
    activeLeafId = leaf.id;
  };
  const handleClickCloseToTop = (ev: MouseEvent, leaf: Leaf) => {
    const index = state.tabIdToIndex[leaf.id];
    const activeLeafIndex = state.tabIdToIndex[activeLeafId];
    if (0 <= activeLeafIndex && activeLeafIndex < index) {
      activeLeafId = leaves[index + 1].id;
    }
    leaves.slice(0, index).forEach((l) => {
      l.detach();
    });
  };
  const handleClickCloseToBottom = (ev: MouseEvent, leaf: Leaf) => {
    const index = state.tabIdToIndex[leaf.id];
    const activeLeafIndex = state.tabIdToIndex[activeLeafId];
    if (index + 1 <= activeLeafIndex && activeLeafIndex <= leaves.length - 1) {
      activeLeafId = leaves[index].id;
    }
    leaves.slice(index + 1, leaves.length).forEach((l) => {
      l.detach();
    });
  };
  const handleClickPin = (ev: MouseEvent, leaf: Leaf) => {
    leaf.setPinned(true);
    updateView.bind(view)();
  };
  const handleClickPinOff = (ev: MouseEvent, leaf: Leaf) => {
    leaf.setPinned(false);
    updateView.bind(view)();
  };
  const handleClickDelete = async (ev: MouseEvent, leaf: Leaf) => {
    // @ts-expect-error
    await deleteVaultFile(plugin.app, leaf.view.file.path);
    updateView.bind(view)();
  };
  const handleClickTrashSystem = async (ev: MouseEvent, leaf: Leaf) => {
    // @ts-expect-error
    await trashVaultFile(plugin.app, leaf.view.file.path, true);
    updateView.bind(view)();
  };
  const handleClickTrashLocal = async (ev: MouseEvent, leaf: Leaf) => {
    // @ts-expect-error
    await trashVaultFile(plugin.app, leaf.view.file.path, false);
    updateView.bind(view)();
  };

  function scrollIntoActiveListItem() {
    const activeListItem = document.querySelector(`li[data-leaf-id="${activeLeafId}"]`);
    if (!activeListItem) return;

    const listItemRect = activeListItem.getBoundingClientRect();
    if (!listItemRect) return;
    const parentRect = activeListItem.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    if (listItemRect.top > parentRect.top || listItemRect.bottom < parentRect.bottom) {
      activeListItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  const updateState = (leaves: Leaf[]) => {
    state.tabIdToIndex = {};
    state.sortedTabIds = [];
    leaves.forEach((l, index) => {
      state.tabIdToIndex[l.id] = index;
      state.sortedTabIds.push(l.id);
    });
    localStorage.setItem(STORAGE_KEY.LIST_STATE, JSON.stringify(state));
  };
  $: {
    updateState(leaves);
    setTabIcon();
  }
  $: activeLeafId && scrollIntoActiveListItem();

  const setTabIcon = () => {
    leaves.forEach((leaf) => {
      const selector = `li[data-leaf-id="${leaf.id}"] .${VIEW_LIST_ITEM_TAB_ICON_CLASS}`;
      const tabIcon = document.querySelector(selector) as HTMLElement;
      if (!tabIcon) return;

      const matchedConfig = getMatchedTabIconConfig(
        tabIconRules,
        getDirname(leaf),
        getFilename(leaf),
        regexCompileCache,
      );
      if (matchedConfig) {
        // override
        setIcon(tabIcon, matchedConfig.icon);
      } else if (plugin.settings.defaultTabIcon) {
        // set default
        setIcon(tabIcon, plugin.settings.defaultTabIcon);
      } else if (leaf.getViewState().type === 'markdown') {
        // remove
        setIcon(tabIcon, '');
      }
    });
  };

  onMount(() => {
    Sortable.create(list, {
      group: 'vertical-tabs-view-list',
      delay: 100,
      delayOnTouchOnly: true,
      touchStartThreshold: 3,
      animation: 150,
      draggable: '.vertical-tabs-view-list-item',
      direction: 'vertical',
      ghostClass: 'vertical-tabs-view-list-item-ghost',
      chosenClass: 'vertical-tabs-view-list-item-chosen',
      forceFallback: !Platform.isDesktop,
      fallbackOnBody: !Platform.isDesktop,
      onChange: (ev) => {
        const scrollContainer = document.querySelector(`#${viewContentId}`);
        if (!scrollContainer) return;

        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        const itemRect = ev.item.getBoundingClientRect();
        const threshold = itemRect.height * 2;

        if (itemRect.top < threshold) {
          scrollContainer.scrollBy({ top: -threshold, behavior: 'smooth' });
        } else if (scrollContainerRect.height - itemRect.top < threshold) {
          scrollContainer.scrollBy({ top: threshold, behavior: 'smooth' });
        }
      },
      onEnd: (ev: SortableEvent) => {
        if (ev.oldIndex == null || ev.newIndex == null) return;
        const start = Math.min(ev.oldIndex, ev.newIndex);
        const end = Math.max(ev.oldIndex, ev.newIndex);

        for (let i = start; i <= end; i++) {
          const item = list.children[i];
          const leafId = item.getAttribute('data-leaf-id');
          if (leafId) {
            state.tabIdToIndex[leafId] = i;
            state.sortedTabIds[i] = leafId;
            localStorage.setItem(STORAGE_KEY.LIST_STATE, JSON.stringify(state));
          }
        }
      },
    });
    setTabIcon();
    scrollIntoActiveListItem();
  });

  const createMenu = (selectedLeaf: Leaf) => {
    const menu = new Menu();
    menu.addItem((item) => {
      return item
        .setTitle('Close')
        .setIcon('x')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickClose(e, selectedLeaf);
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle('Close others')
        .setIcon('x')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickCloseOthers(e, selectedLeaf);
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle('Close to the top')
        .setIcon('x')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickCloseToTop(e, selectedLeaf);
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle('Close to the bottom')
        .setIcon('x')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickCloseToBottom(e, selectedLeaf);
        });
    });
    menu.addSeparator();
    if (selectedLeaf && !selectedLeaf.pinned) {
      menu.addItem((item) => {
        return item
          .setTitle('Pin')
          .setIcon('pin')
          .onClick((e: MouseEvent) => {
            e.preventDefault();
            handleClickPin(e, selectedLeaf);
          });
      });
    }
    if (selectedLeaf && selectedLeaf.pinned) {
      menu.addItem((item) => {
        return item
          .setTitle('Unpin')
          .setIcon('pin-off')
          .onClick((e: MouseEvent) => {
            e.preventDefault();
            handleClickPinOff(e, selectedLeaf);
          });
      });
    }
    menu.addSeparator();
    menu.addItem((item) => {
      return item
        .setTitle('Trach local')
        .setIcon('trash')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickTrashLocal(e, selectedLeaf);
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle('Trach system')
        .setIcon('trash')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickTrashSystem(e, selectedLeaf);
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle('Delete file')
        .setIcon('trash-2')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickDelete(e, selectedLeaf);
        });
    });
    return menu;
  };
</script>

<ul id="vertical-tabs-view-list" class="vertical-tabs-view-list" bind:this={list}>
  {#each leaves as leaf}
    <li
      data-leaf-id={leaf.id}
      class="vertical-tabs-view-list-item"
      class:focused={leaf.id === activeLeafId}
      on:mousedown={(e) => handleMouseDown(e, leaf)}
      on:contextmenu={(e) => {
        const menu = createMenu(leaf);
        menu.showAtMouseEvent(e);
      }}
    >
      <div class="vertical-tabs-view-list-item-left-container">
        {#if plugin.settings.showCloseIcon}
          <div
            class="vertical-tabs-view-list-item-close-btn vertical-tabs-view-list-item-icon"
            on:click={(e) => handleClickClose(e, leaf)}
          >
            <X size={18} strokeWidth={2} />
          </div>
        {/if}
        {#if plugin.settings.showTabIcon}
          <div class="vertical-tabs-view-list-item-tab-icon vertical-tabs-view-list-item-icon" />
        {/if}
        <div class="vertical-tabs-view-list-item-name-container">
          {#if plugin.settings.showDirectory}
            <span class="vertical-tabs-view-list-item-dirname">{getDirname(leaf)}</span>
          {/if}
          <span class="vertical-tabs-view-list-item-title">{getFilename(leaf)}</span>
        </div>
      </div>
      <div class="vertical-tabs-view-list-item-right-container">
        {#if !leaf.pinned && plugin.settings.showPinIconIfNotPinned}
          <div
            class="vertical-tabs-view-list-item-icon vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-pin"
            on:click={(e) => handleClickPin(e, leaf)}
          >
            <Pin size={20} />
          </div>
        {:else if leaf.pinned && plugin.settings.showPinnedIcon}
          <div
            class="vertical-tabs-view-list-item-icon vertical-tabs-view-list-item-icon-pinned vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-pin"
            on:click={(e) => handleClickPinOff(e, leaf)}
          >
            <Pin size={20} />
          </div>
        {/if}
      </div>
    </li>
  {/each}
  {#if leaves.length > 0 && Platform.isMobile}
    <div class="vertical-tabs-view-list-mobile-margin-block" />
  {/if}
</ul>

<style>
  :root {
    --ctx-menu-font-size: 0.9rem;
    --ctx-menu-margin: 0.25rem 0;
    --ctx-menu-padding: 0;
    --ctx-menu-item-padding: 0 0.5rem;
    --ctx-menu-divider-margin: 0.2rem 0;
  }
</style>

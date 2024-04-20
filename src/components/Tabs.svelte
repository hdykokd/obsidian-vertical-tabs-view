<script lang="ts">
  import { onMount } from 'svelte';
  import { Menu, Platform, setIcon } from 'obsidian';
  import Sortable, { type SortableEvent } from 'sortablejs';
  import { X, Pin } from 'lucide-svelte';
  import store from '../store';
  import type VerticalTabsView from '../main';
  import type { Leaf } from '../types';
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
  $: settings = plugin.settings;
  $: tabIconRules = settings.tabIconRules.slice().sort((a, b) => b.priority - a.priority);

  let leaves: Leaf[] = [];
  $: leaves = leaves;

  let activeLeafId: string = '';
  $: activeLeafId = activeLeafId;

  let selectedLeafIds: string[] = [];
  $: selectedLeafIds = selectedLeafIds;

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

  const regexCompileCache: Record<string, RegExp> = {};

  const getDirname = (leaf: Leaf) => {
    // @ts-expect-error
    const file = leaf.view?.file;
    if (!file) return '';
    return file.parent?.path || '';
  };

  const getFilename = (leaf: Leaf) => {
    // @ts-expect-error
    const file = leaf.view?.file;
    if (!file) return '';

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

  const closeLeaf = (leaf: Leaf) => {
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

  const handleMouseDown = async (ev: MouseEvent, leaf: Leaf) => {
    ev.stopPropagation();

    if (ev.button === 1) {
      // middle click
      closeLeaf(leaf);
      return;
    }

    if (ev.button === 2) {
      return; // right click is handled by on:contextmenu
    }

    if (ev.target instanceof SVGElement) {
      return; // icon
    }

    if (ev.shiftKey) {
      const clickedLeafIndex = state.tabIdToIndex[leaf.id];
      const activeLeafIndex = state.tabIdToIndex[activeLeafId];
      const start = Math.min(clickedLeafIndex, activeLeafIndex);
      const end = Math.max(clickedLeafIndex, activeLeafIndex);
      const newSelectedLeafIds: string[] = [];
      for (let i = start; i <= end; i++) {
        const leaf = leaves[i];
        if (leaf) {
          newSelectedLeafIds.push(leaf.id);
        }
      }
      selectedLeafIds = Array.from(new Set([...selectedLeafIds, ...newSelectedLeafIds]));
    } else if (ev.metaKey) {
      if (!selectedLeafIds.length) {
        selectedLeafIds = [activeLeafId];
      }
      if (!selectedLeafIds.includes(leaf.id)) {
        selectedLeafIds = [...selectedLeafIds, leaf.id];
      } else {
        selectedLeafIds = selectedLeafIds.filter((id) => id !== leaf.id);
      }
    } else {
      selectedLeafIds = [];
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
    }
  };

  const handleBulkAction = async (leafIds: string[], action: (leaf: Leaf) => void | Promise<void>) => {
    const leafIdSet = new Set(leafIds);
    for (const leaf of leaves) {
      if (leafIdSet.has(leaf.id)) {
        const result = action(leaf);
        if (result instanceof Promise) {
          await result.catch(console.error);
        }
        leafIdSet.delete(leaf.id);
      }
      if (leafIdSet.size === 0) {
        updateView.bind(view)();
        return;
      }
    }
    updateView.bind(view)();
  };

  const closeLeaves = async (leaveIds: string[]) => {
    await handleBulkAction(leaveIds, (leaf) => leaf.detach());
  };

  const handleClickClose = (leaf: Leaf) => {
    closeLeaf(leaf);
  };
  const handleClickCloseOthers = async (leafIds: string[]) => {
    const targetLeafIds = leaves.filter((l) => !leafIds.includes(l.id)).map((l) => l.id);
    await closeLeaves(targetLeafIds);
  };
  const handleClickCloseAllAbove = (leaf: Leaf) => {
    const index = state.tabIdToIndex[leaf.id];
    const activeLeafIndex = state.tabIdToIndex[activeLeafId];
    if (0 <= activeLeafIndex && activeLeafIndex < index) {
      activeLeafId = leaves[index + 1].id;
    }
    leaves.slice(0, index).forEach((l) => {
      l.detach();
    });
  };
  const handleClickCloseAllBelow = (leaf: Leaf) => {
    const index = state.tabIdToIndex[leaf.id];
    const activeLeafIndex = state.tabIdToIndex[activeLeafId];
    if (index + 1 <= activeLeafIndex && activeLeafIndex <= leaves.length - 1) {
      activeLeafId = leaves[index].id;
    }
    leaves.slice(index + 1, leaves.length).forEach((l) => {
      l.detach();
    });
  };
  const handleClickPin = (leaf: Leaf, pinned: boolean) => {
    leaf.setPinned(pinned);
    updateView.bind(view)();
  };
  const handleClickBulkPin = (leafIds: string[], pinned: boolean) => {
    return handleBulkAction(leafIds, (leaf) => leaf.setPinned(pinned));
  };
  const handleClickDelete = async (leaf: Leaf) => {
    // @ts-expect-error
    const file = leaf.view.file;
    if (file.deleted) return;
    await deleteVaultFile(plugin.app, file.path);
    updateView.bind(view)();
  };
  const handleClickBulkDelete = async (leafIds: string[]) => {
    return handleBulkAction(leafIds, async (leaf) => {
      // @ts-expect-error
      const file = leaf.view.file;
      if (file.deleted) return;
      await deleteVaultFile(plugin.app, file.path);
    });
  };
  const handleClickTrashSystem = async (leaf: Leaf) => {
    // @ts-expect-error
    await trashVaultFile(plugin.app, leaf.view.file.path, true);
    updateView.bind(view)();
  };
  const handleClickBulkTrashSystem = async (leafIds: string[]) => {
    return handleBulkAction(leafIds, async (leaf) => {
      // @ts-expect-error
      await trashVaultFile(plugin.app, leaf.view.file.path, true);
    });
  };
  const handleClickTrashLocal = async (leaf: Leaf) => {
    // @ts-expect-error
    await trashVaultFile(plugin.app, leaf.view.file.path, false);
    updateView.bind(view)();
  };
  const handleClickBulkTrashLocal = async (leafIds: string[]) => {
    return handleBulkAction(leafIds, async (leaf) => {
      // @ts-expect-error
      await trashVaultFile(plugin.app, leaf.view.file.path, false);
    });
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

      if (!settings.showTabIcon) {
        tabIcon.addClass('_hidden');
        return;
      } else {
        tabIcon.removeClass('_hidden');
      }

      if (!settings.customizeTabIcon) {
        const _leaf = plugin.app.workspace.getLeafById(leaf.id);
        // @ts-expect-error
        const iconEl = _leaf.tabHeaderInnerIconEl.firstChild.cloneNode(true);
        if (!iconEl) return;

        if (iconEl) {
          tabIcon.setChildrenInPlace([iconEl]);
          return;
        }
      }

      const matchedConfig = getMatchedTabIconConfig(
        tabIconRules,
        getDirname(leaf),
        getFilename(leaf),
        regexCompileCache,
      );
      if (matchedConfig) {
        // override
        setIcon(tabIcon, matchedConfig.icon);
      } else if (settings.defaultTabIcon) {
        // set default
        setIcon(tabIcon, settings.defaultTabIcon);
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

    const isBulkEdit = selectedLeafIds.length > 1 && selectedLeafIds.includes(selectedLeaf.id);
    const leafIds = isBulkEdit ? selectedLeafIds : [selectedLeaf.id];
    const titleTabs = isBulkEdit ? `${leafIds.length} tabs` : `tab`;
    const uniqueFilepaths = Array.from(
      new Set(
        leaves
          .filter((l) => leafIds.includes(l.id))
          .map((l) => {
            // @ts-expect-error
            const file = l.view.file;
            const dirname = file.parent?.path || '';
            const filename = file.name;
            return `${dirname}${filename}`;
          }),
      ),
    );
    const titleFiles = isBulkEdit && uniqueFilepaths.length ? `${uniqueFilepaths.length} files` : `file`;

    const onClose = () => {
      selectedLeafIds = [];
    };

    menu.addItem((item) => {
      return item
        .setTitle(`Close ${titleTabs}`)
        .setIcon('x')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          if (isBulkEdit) {
            closeLeaves(leafIds);
          } else {
            closeLeaf(selectedLeaf);
          }
        });
    });
    menu.addItem((item) => {
      const unselectedTabs = leaves.length - leafIds.length;
      return item
        .setTitle(`Close others (${unselectedTabs} unselected tabs)`)
        .setIcon('x')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickCloseOthers(leafIds);
          onClose();
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle('Close all tabs above')
        .setIcon('x')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickCloseAllAbove(selectedLeaf);
          onClose();
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle('Close all tabs below')
        .setIcon('x')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          handleClickCloseAllBelow(selectedLeaf);
          onClose();
        });
    });
    menu.addSeparator();
    if (isBulkEdit) {
      const pinnedLeaves: Leaf[] = [];
      const unpinnedLeaves: Leaf[] = [];
      leaves.forEach((l) => {
        if (l.pinned && leafIds.includes(l.id)) {
          pinnedLeaves.push(l);
        } else if (!l.pinned && leafIds.includes(l.id)) {
          unpinnedLeaves.push(l);
        }
      });

      if (unpinnedLeaves.length) {
        menu.addItem((item) => {
          return item
            .setTitle(`Pin ${unpinnedLeaves.length} tabs`)
            .setIcon('pin')
            .onClick((e: MouseEvent) => {
              e.preventDefault();
              handleClickBulkPin(
                unpinnedLeaves.map((l) => l.id),
                true,
              );
              onClose();
            });
        });
      }
      if (pinnedLeaves.length) {
        menu.addItem((item) => {
          return item
            .setTitle(`Unpin ${pinnedLeaves.length} tabs`)
            .setIcon('pin-off')
            .onClick((e: MouseEvent) => {
              e.preventDefault();
              handleClickBulkPin(
                pinnedLeaves.map((l) => l.id),
                false,
              );
              onClose();
            });
        });
      }
    } else {
      if (!selectedLeaf.pinned) {
        menu.addItem((item) => {
          return item
            .setTitle(`Pin`)
            .setIcon('pin')
            .onClick((e: MouseEvent) => {
              e.preventDefault();
              handleClickPin(selectedLeaf, true);
              onClose();
            });
        });
      }
      if (selectedLeaf.pinned) {
        menu.addItem((item) => {
          return item
            .setTitle(`Unpin`)
            .setIcon('pin-off')
            .onClick((e: MouseEvent) => {
              e.preventDefault();
              handleClickPin(selectedLeaf, false);
              onClose();
            });
        });
      }
    }
    menu.addSeparator();
    menu.addItem((item) => {
      return item
        .setTitle(`Trash ${titleFiles} to local`)
        .setIcon('trash')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          if (isBulkEdit) {
            handleClickBulkTrashLocal(leafIds);
          } else {
            handleClickTrashLocal(selectedLeaf);
          }
          onClose();
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle(`Trash ${titleFiles} to system`)
        .setIcon('trash')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          if (isBulkEdit) {
            handleClickBulkTrashSystem(leafIds);
          } else {
            handleClickTrashSystem(selectedLeaf);
          }
          onClose();
        });
    });
    menu.addItem((item) => {
      return item
        .setTitle(`Delete ${titleFiles}`)
        .setIcon('trash-2')
        .onClick((e: MouseEvent) => {
          e.preventDefault();
          if (isBulkEdit) {
            handleClickBulkDelete(leafIds);
          } else {
            handleClickDelete(selectedLeaf);
          }
          onClose();
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
      class:selected={selectedLeafIds.includes(leaf.id)}
      class:focused={leaf.id === activeLeafId}
      on:mousedown={(e) => handleMouseDown(e, leaf)}
      on:contextmenu={(e) => {
        const menu = createMenu(leaf);
        menu.showAtMouseEvent(e);
      }}
    >
      <div class="vertical-tabs-view-list-item-left-container">
        {#if settings.showCloseIcon}
          <div
            class="vertical-tabs-view-list-item-close-btn vertical-tabs-view-list-item-icon"
            on:click={(e) => handleClickClose(leaf)}
          >
            <X />
          </div>
        {/if}
        <div class="vertical-tabs-view-list-item-tab-icon vertical-tabs-view-list-item-icon" />
        <div class="vertical-tabs-view-list-item-name-container">
          {#if settings.showDirectory}
            <span class="vertical-tabs-view-list-item-dirname">{getDirname(leaf)}</span>
          {/if}
          <span class="vertical-tabs-view-list-item-title">{getFilename(leaf)}</span>
        </div>
      </div>
      <div class="vertical-tabs-view-list-item-right-container">
        {#if settings.showPinIconIfNotPinned && !leaf.pinned}
          <div
            class="vertical-tabs-view-list-item-icon vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-pin"
            on:click={() => handleClickPin(leaf, true)}
          >
            <Pin />
          </div>
        {:else if settings.showPinnedIcon && leaf.pinned}
          <div
            class="vertical-tabs-view-list-item-icon vertical-tabs-view-list-item-icon-pinned vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-pin"
            on:click={() => handleClickPin(leaf, false)}
          >
            <Pin />
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

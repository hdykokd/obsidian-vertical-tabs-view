<script lang="ts">
  import store from '../store';
  import type VerticalTabsView from '../main';
  import Sortable, { type SortableEvent } from 'sortablejs';
  import { onMount } from 'svelte';
  import type { Leaf, TabIconRule } from '../types';
  import { X, Pin, PinOff } from 'lucide-svelte';
  import type { VerticalTabsViewSettings } from '../setting';
  import type { VerticalTabsViewView } from '../view';
  import { setIcon } from 'obsidian';
  import { getMatchedTabIconConfig } from 'src/util/view';

  const VIEW_PREFIX = 'vertical-tabs-view';
  const VIEW_LIST_ITEM_CLASS = VIEW_PREFIX + '-list-item';
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
  export let setActiveLeaf: Function;
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
    if (ev.target instanceof SVGElement) {
      return; // icon
    }
    await setActiveLeaf.bind(plugin)(leaf);

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
    ev.stopPropagation();
    leaf.detach();
    updateView.bind(view)();
  };
  const handleClickPin = (ev: MouseEvent, leaf: Leaf) => {
    ev.stopPropagation();
    leaf.setPinned(true);
    updateView.bind(view)();
  };
  const handleClickPinOff = (ev: MouseEvent, leaf: Leaf) => {
    ev.stopPropagation();
    leaf.setPinned(false);
    updateView.bind(view)();
  };

  const scrollIntoActiveListItem = () => {
    const activeListItem = document.querySelector(`.${VIEW_LIST_ITEM_CLASS}.focused`);
    if (!activeListItem) return;

    const listItemRect = activeListItem.getBoundingClientRect();
    if (!listItemRect) return;
    const parentRect = activeListItem.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    if (listItemRect.top > parentRect.top || listItemRect.bottom < parentRect.bottom) {
      activeListItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

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
    scrollIntoActiveListItem();
    setTabIcon();
  }

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
      delay: 500,
      delayOnTouchOnly: true,
      touchStartThreshold: 3,
      direction: 'vertical',
      ghostClass: 'vertical-tabs-view-list-item-ghost',
      animation: 150,
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
    scrollIntoActiveListItem();
    setTabIcon();
  });
</script>

<div>
  <ul id="vertical-tabs-view-list" class="vertical-tabs-view-list" bind:this={list}>
    {#each leaves as leaf}
      <li
        data-leaf-id={leaf.id}
        class="vertical-tabs-view-list-item"
        class:focused={leaf.id === activeLeafId}
        on:mousedown={(e) => handleMouseDown(e, leaf)}
      >
        <div class="vertical-tabs-view-list-item-left-container">
          <div
            class="vertical-tabs-view-list-item-close-btn vertical-tabs-view-list-item-icon"
            on:click={(e) => handleClickClose(e, leaf)}
          >
            <X size={18} strokeWidth={2} />
          </div>
          <div class="vertical-tabs-view-list-item-tab-icon vertical-tabs-view-list-item-icon" />
          <div class="vertical-tabs-view-list-item-name-container">
            <span class="vertical-tabs-view-list-item-dirname">{getDirname(leaf)}</span>
            <span class="vertical-tabs-view-list-item-title">{getFilename(leaf)}</span>
          </div>
        </div>
        <div class="vertical-tabs-view-list-item-right-container">
          {#if !leaf.pinned && plugin.settings.showPinIconIfNotPinned}
            <div
              class="vertical-tabs-view-list-item-icon vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-pin"
              on:click={(e) => handleClickPin(e, leaf)}
            >
              <Pin size={20} strokeWidth={2} />
            </div>
          {:else if leaf.pinned && plugin.settings.showPinnedIcon}
            <div
              class="vertical-tabs-view-list-item-icon vertical-tabs-view-list-item-pin-btn vertical-tabs-view-list-item-pin-btn-pin"
              on:click={(e) => handleClickPinOff(e, leaf)}
            >
              <PinOff size={20} strokeWidth={2} />
            </div>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
</div>

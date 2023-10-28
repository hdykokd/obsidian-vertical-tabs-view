import { writable } from 'svelte/store';
import type VerticalTabsView from './main';
import type { VerticalTabsViewSettings } from './setting';
import type { Leaf } from './types';

const plugin = writable<VerticalTabsView>();
const settings = writable<VerticalTabsViewSettings>();
const leaves = writable<Leaf[]>([]);
const activeLeafId = writable<string>();

export default { plugin, settings, leaves, activeLeafId };

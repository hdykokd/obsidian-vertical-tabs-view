import { writable } from 'svelte/store';
import type VerticalTabsView from './main';
import type { Leaf } from './types';

const plugin = writable<VerticalTabsView>();
const leaves = writable<Leaf[]>([]);
const activeLeafId = writable<string>();

export default { plugin, leaves, activeLeafId };

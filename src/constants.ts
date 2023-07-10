export const DEFAULT_POSITION_OPTIONS = {
  left: 'left',
  right: 'right',
} as const;

export const TAB_ICON_OPTIONS = {
  TARGET: {
    directory: 'directory',
    title: 'title',
  },
  CONDITION: {
    startsWith: 'startsWith',
    endsWith: 'endsWith',
    includes: 'includes',
    exact: 'exact',
    regexp: 'regexp',
  },
} as const;

export const DEFAULT_TAB_ICON_CONFIG = {
  matchConfig: {
    target: 'title',
    condition: 'startsWith',
    value: '',
  },
  priority: 1,
  icon: 'file',
};

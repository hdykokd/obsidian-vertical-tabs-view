import { TAB_ICON_OPTIONS } from './constants';

export type TabIconRule = {
  matchConfig: {
    target: keyof (typeof TAB_ICON_OPTIONS)['TARGET'];
    condition: keyof (typeof TAB_ICON_OPTIONS)['CONDITION'];
    value: string;
  };
  priority: number;
  icon: string;
};

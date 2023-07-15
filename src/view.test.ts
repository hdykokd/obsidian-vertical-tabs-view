import { describe, expect, it } from 'vitest';
import { DEFAULT_TAB_ICON_CONFIG } from './constants';
import { TabIconRule } from './types';
import { getMatchedTabIconConfig } from './util/view';

const generateConfig = (matchConfig: TabIconRule['matchConfig']) => {
  return {
    ...DEFAULT_TAB_ICON_CONFIG,
    matchConfig,
  };
};

describe('VerticalTabsViewView', () => {
  describe('getMatchedTabIconConfig', () => {
    const cases: [TabIconRule, string, string][] = [
      [generateConfig({ target: 'directory', condition: 'startsWith', value: 'dir' }), 'dirname', 'title'],
      [generateConfig({ target: 'directory', condition: 'endsWith', value: 'name' }), 'dirname', 'title'],
      [generateConfig({ target: 'directory', condition: 'includes', value: 'ir' }), 'dirname', 'title'],
      [generateConfig({ target: 'directory', condition: 'equals', value: 'dirname' }), 'dirname', 'title'],
      [generateConfig({ target: 'directory', condition: 'regexp', value: '/^dirname$/i' }), 'dirname', 'title'],
      [generateConfig({ target: 'title', condition: 'startsWith', value: 'tit' }), 'dirname', 'title'],
      [generateConfig({ target: 'title', condition: 'endsWith', value: 'tle' }), 'dirname', 'title'],
      [generateConfig({ target: 'title', condition: 'includes', value: 'itl' }), 'dirname', 'title'],
      [generateConfig({ target: 'title', condition: 'equals', value: 'title' }), 'dirname', 'title'],
      [generateConfig({ target: 'title', condition: 'regexp', value: '/^title$/i' }), 'dirname', 'title'],
    ];
    cases.forEach(([config, dirname, title]) => {
      const { target, condition, value } = config.matchConfig;
      it(`${target} ${condition} ${value}`, () => {
        const result = getMatchedTabIconConfig([config], dirname, title, {});
        expect(result).not.toBeUndefined();
      });
    });
  });
});

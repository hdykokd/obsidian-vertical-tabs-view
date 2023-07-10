import { TabIconConfig } from 'src/types';

export const getMatchedTabIconConfig = (
  configs: TabIconConfig[],
  dirname: string,
  title: string,
  regexpCompileCache: Record<string, RegExp>,
) => {
  const compileRegExp = (value: string) => {
    if (regexpCompileCache[value]) return regexpCompileCache[value];
    const [_, cond, flags] = value.split('/');
    const regexp = new RegExp(cond, flags);
    regexpCompileCache[value] = regexp;
    return regexp;
  };

  const matchValue = (c: TabIconConfig, value: string) => {
    if (c.matchConfig.condition === 'startsWith') {
      if (value.startsWith(c.matchConfig.value)) return true;
    }
    if (c.matchConfig.condition === 'endsWith') {
      if (value.endsWith(c.matchConfig.value)) return true;
    }
    if (c.matchConfig.condition === 'includes') {
      if (value.includes(c.matchConfig.value)) return true;
    }
    if (c.matchConfig.condition === 'exact') {
      if (value === c.matchConfig.value) return true;
    }
    if (c.matchConfig.condition === 'regexp') {
      const regexp = compileRegExp(c.matchConfig.value);
      if (regexp.test(value)) return true;
    }
  };

  return configs.find((c) => {
    if (c.matchConfig.target === 'directory') {
      return matchValue(c, dirname);
    }
    if (c.matchConfig.target === 'title') {
      return matchValue(c, title);
    }
  });
};

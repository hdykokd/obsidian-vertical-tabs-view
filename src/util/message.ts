import { Notice } from 'obsidian';
import { name as logPrefix } from '../../package.json';

export const log = (message: string) => {
  console.log(`[${logPrefix}]: ${message}`);
};

export const notice = (message: string) => {
  new Notice(`[${logPrefix}]: ${message}`);
};

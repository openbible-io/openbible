import { createContext } from "solid-js";
import { useLocalStorage, useUserStyle } from './utils';

export const createInteraction = () => ({
	'select-verse-nums': useLocalStorage('select-verse-nums', false),
});
export const createCssVars = () => ({
	'--primary-text-color': useUserStyle('--primary-text-color'),
	'--primary-text-indent': useUserStyle('--primary-text-indent'),
	'--primary-theme-color': useUserStyle('--primary-theme-color'),
	'--primary-font-family': useUserStyle('--primary-font-family'),
	'--secondary-font-family': useUserStyle('--secondary-font-family'),
	'--reader-font-family': useUserStyle('--reader-font-family'),
	'--reader-font-size': useUserStyle('--reader-font-size'),
});

export const Interaction = createContext<ReturnType<typeof createInteraction>>();
export const CssVars = createContext<ReturnType<typeof createCssVars>>();

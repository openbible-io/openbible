import { createContext, createResource, ResourceReturn } from 'solid-js';
import { useUserStyle, BookId } from './utils';

// Kinda a mess, could be cleaned up with a tagged union
export interface CssVarControl {
	label: string;
	type: 'checkbox' | 'number' | 'color' | 'text';
	toString: (v: boolean | string) => string;
	min: number;
	max: number;
	step: number;
};

export const cssVars = {
	'--primary-text-color': {},
	'--primary-theme-color': {},
	'--primary-font-family': {},
	'--reader-font-family': {},
	'--reader-font-size': {},
	'--global-font-size': {},
	'--h-display': {
		label: 'Show section headers',
		type: 'checkbox',
		toString: (v: boolean) => v ? 'block' : 'none',
	} as Partial<CssVarControl>,
	'--sr-display': {
		label: 'Show section header references',
		type: 'checkbox',
		toString: (v: boolean) => v ? 'block' : 'none',
	} as Partial<CssVarControl>,
	'--verse-num-display': {
		label: 'Show verse numbers',
		type: 'checkbox',
		toString: (v: boolean) => v ? 'inline' : 'none',
	} as Partial<CssVarControl>,
	'--verse-num-user-select': {
		label: 'Selectable verse numbers',
		type: 'checkbox',
		toString: (v: boolean) => v ? 'auto' : 'none',
	} as Partial<CssVarControl>,
	'--first-chapter-letter-weight': {},
	'--first-chapter-letter-size': {},
};
export type CssVar = keyof typeof cssVars;

export function createCssVars() {
	return (Object.keys(cssVars) as CssVar[]).reduce((acc, cur) => {
		acc[cur] = useUserStyle(cur);
		return acc;
	}, {} as { [key in CssVar]: ReturnType<typeof useUserStyle> });
}

export const CssVars = createContext<ReturnType<typeof createCssVars>>();

export type Books = {
	[book in BookId]: number | number[];
};
export type BibleIndex = {
	publisher: string,
	title: string,
	date: string,
	modified: string,
	license: string
	authors: string[],
	books: Books,
	about?: string,
};
export type BibleIndices = { [version: string]: BibleIndex };


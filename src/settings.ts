import { createContext, createResource, ResourceReturn } from 'solid-js';
import { useUserStyle, BookId } from './utils';

export const createCssVars = () => ({
	'--primary-text-color': useUserStyle('--primary-text-color'),
	'--primary-theme-color': useUserStyle('--primary-theme-color'),
	'--primary-font-family': useUserStyle('--primary-font-family'),
	'--secondary-font-family': useUserStyle('--secondary-font-family'),
	'--reader-font-family': useUserStyle('--reader-font-family'),
	'--reader-font-size': useUserStyle('--reader-font-size'),
	'--global-font-size': useUserStyle('--global-font-size'),
	'--select-verse-nums': useUserStyle('--select-verse-nums'),
});

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

// only send request once
let cachedBibleIndices: ResourceReturn<BibleIndices, unknown> | undefined;

export function bibleIndices() {
	cachedBibleIndices ||= createResource(async () => {
		return await fetch(`${import.meta.env['OPENBIBLE_STATIC_URL']}/bibles/index.json`)
			.then(res => res.json() as Promise<BibleIndices>);
	});
	return cachedBibleIndices;
}


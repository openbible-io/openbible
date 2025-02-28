import type { Book as SBook, Audiobook as SAudiobook } from "schema-dts";
import type { BookId } from "./books";
import type { Translation } from "./translation";

export * from './books';
export * from './translation';
export type Books = {
	[book in BookId]?: {
		source: Translation;
		translation: Translation;
	};
};
export * from './notes';
export type Book = Exclude<SBook, SAudiobook>;
export type AudioBook = SAudiobook;

export * from "./download";

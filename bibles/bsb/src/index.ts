import type { Book } from "@openbible/core";

export * as data from './generated/index';
export const meta: Book = {
	bookEdition: "3rd",
	bookFormat: "EBook",
	isbn: 9781944757137,
	about: "The Berean Bible is a completely new English translation of the Holy Bible, effective for public reading, study, memorization, and evangelism.",
	abstract: `The Berean Bible is a completely new English translation of the Holy Bible, effective for public reading, study, memorization, and evangelism. Inspired by the words in the Book of Acts, and based on the best available manuscripts and sources, each word is connected back to the Greek or Hebrew text to produce a transparent text that can be studied for its root meanings.

The Berean Study Bible represents a single tier of the Berean Bible. This printing contains the full Berean Bible text, footnotes, section headings, and cross references. It is not what is considered a traditional study Bible, as it includes only the text, cross-references, and footnotes. Additional components, including translation tables, lexicons, outlines, and summaries, are free online and in a variety of apps and software.`,
	archivedAt: "https://berean.bible/downloads.htm",
	author: {
		"@type": "NonprofitType",
		"@id": "Bible Hub",
	},
	license: "https://creativecommons.org/publicdomain/zero/1.0/deed",
	countryOfOrigin: "US",
	funder: "Bible Hub",
	dateModified: "2024-12",
	datePublished: "2022",
	inLanguage: "en-US",
	isAccessibleForFree: true,
	publisher: "BSB Publishing",
};

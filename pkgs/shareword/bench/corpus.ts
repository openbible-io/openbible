import { books } from "@openbible/bsb";
import {
	type BookId,
	isNewTestament,
	type Translation,
} from "@openbible/models";

// Just a list of every word for now to make weighted random selection easy.
// Doesn't use more than a few MB of memory.
export type Dict = string[];

const bsb = await books();

function translationWords(lang: string, translation: Translation): string[] {
	const res: string[] = [];
	const segmenter = new Intl.Segmenter(lang, { granularity: "word" });

	for (const ele of translation) {
		let span = "";
		if (typeof ele === "string") {
			span = ele;
		} else if ("text" in ele) {
			span = ele.text;
		} // ignore headings
		for (const seg of segmenter.segment(span)) res.push(seg.segment);
	}

	return res;
}

export const dictionaries: { [lang: string]: Dict } = {
	en: [],
	he: [],
	gr: [],
};

for (const [book, { translation, source }] of Object.entries(bsb)) {
	dictionaries.en = dictionaries.en.concat(translationWords("en", translation));
	if (!isNewTestament(book as BookId)) {
		dictionaries.he = dictionaries.he.concat(translationWords("he", source));
	} else {
		dictionaries.gr = dictionaries.gr.concat(translationWords("gr", source));
	}
}

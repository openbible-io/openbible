export function getChapterPath(
	version: string,
	book: string,
	chapter: number
) {
	return `./${version}/${book}-${(chapter + '').padStart(2, '0')}.json`
}

// TODO: types
const cache = {} as { [key: string]: ParagraphType[] }

export interface NoteType {
	note: string;
	// Need these to pass back up on note submit
	toId: number;
	fromId: number;
	isFormOpen: boolean;
}

export interface VerseType {
	t: string;
	c?: string;
	n?: number;
	v?: string | VerseType[];
	id: number;
	// Added by frontend
	parent?: ParagraphType;
	highlight?: string;
	noted?: number | null;
	note?: NoteType;
}

export interface ParagraphType {
	t: string;
	v: VerseType[]
	id: number;
}

export function getChapter(
	version: string,
	book: string,
	chapter: number
): Promise<ParagraphType[]> {
	const path = getChapterPath(version, book, chapter)
	if (!cache[path]) {
		return new Promise((resolve, reject) => {
			fetch(path)
				.then(res => res.json())
				.then(paragraphs => {
					resolve(paragraphs)
					cache[path] = paragraphs
				})
				.catch(reject)
		})
	}
	return new Promise(resolve => resolve(cache[path]))
}

export const books = {
	'GEN': {
		name: 'Genesis',
		chapters: 50
	},
	'EXO': {
		name: 'Exodus',
		chapters: 40
	},
	'LEV': {
		name: 'Leviticus',
		chapters: 27
	},
	'NUM': {
		name: 'Numbers',
		chapters: 36
	},
	'DEU': {
		name: 'Deuteronomy',
		chapters: 34
	},
	'JOS': {
		name: 'Joshua',
		chapters: 24
	},
	'JDG': {
		name: 'Judges',
		chapters: 21
	},
	'RUT': {
		name: 'Ruth',
		chapters: 4
	},
	'1SA': {
		name: '1 Samuel',
		chapters: 31
	},
	'2SA': {
		name: '2 Samuel',
		chapters: 24
	},
	'1KI': {
		name: '1 Kings',
		chapters: 22
	},
	'2KI': {
		name: '2 Kings',
		chapters: 25
	},
	'1CH': {
		name: '1 Chronicles',
		chapters: 29
	},
	'2CH': {
		name: '2 Chronicles',
		chapters: 36
	},
	'EZR': {
		name: 'Ezra',
		chapters: 10
	},
	'NEH': {
		name: 'Nehamiah',
		chapters: 13
	},
	'EST': {
		name: 'Esther',
		chapters: 10
	},
	'JOB': {
		name: 'Job',
		chapters: 42
	},
	'PSA': {
		name: 'Psalm',
		chapters: 150
	},
	'PRO': {
		name: 'Proverbs',
		chapters: 31
	},
	'ECC': {
		name: 'Ecclessiates',
		chapters: 12
	},
	'SNG': {
		name: 'Song of Solomon',
		chapters: 8
	},
	'ISA': {
		name: 'Isiah',
		chapters: 66
	},
	'JER': {
		name: 'Jeremiah',
		chapters: 52
	},
	'LAM': {
		name: 'Lamentations',
		chapters: 5
	},
	'EZK': {
		name: 'Ezekiel',
		chapters: 48
	},
	'DAN': {
		name: 'Daniel',
		chapters: 12
	},
	'HOS': {
		name: 'Hosea',
		chapters: 14
	},
	'JOL': {
		name: 'Joel',
		chapters: 3
	},
	'AMO': {
		name: 'Amos',
		chapters: 9
	},
	'OBA': {
		name: 'Obadiah',
		chapters: 1
	},
	'JON': {
		name: 'Jonah',
		chapters: 4
	},
	'MIC': {
		name: 'Micah',
		chapters: 7
	},
	'NAM': {
		name: 'Nahum',
		chapters: 3
	},
	'HAB': {
		name: 'Habakkuk',
		chapters: 3
	},
	'ZEP': {
		name: 'Zephaniah',
		chapters: 3
	},
	'HAG': {
		name: 'Haggai',
		chapters: 2
	},
	'ZEC': {
		name: 'Zechariah',
		chapters: 14
	},
	'MAL': {
		name: 'Malachi',
		chapters: 4
	},
	'MAT': {
		name: 'Matthew',
		chapters: 28
	},
	'MRK': {
		name: 'Mark',
		chapters: 16
	},
	'LUK': {
		name: 'Luke',
		chapters: 24
	},
	'JHN': {
		name: 'John',
		chapters: 21
	},
	'ACT': {
		name: 'Acts',
		chapters: 28
	},
	'ROM': {
		name: 'Romans',
		chapters: 16
	},
	'1CO': {
		name: '1 Corinthians',
		chapters: 16
	},
	'2CO': {
		name: '2 Corinthians',
		chapters: 13
	},
	'GAL': {
		name: 'Galatians',
		chapters: 6
	},
	'EPH': {
		name: 'Ephesians',
		chapters: 6
	},
	'PHP': {
		name: 'Philippians',
		chapters: 4
	},
	'COL': {
		name: 'Colossians',
		chapters: 4
	},
	'1TH': {
		name: '1 Thessalonians',
		chapters: 5
	},
	'2TH': {
		name: '2 Thessalonians',
		chapters: 3
	},
	'1TI': {
		name: '1 Timothy',
		chapters: 6
	},
	'2TI': {
		name: '2 Timothy',
		chapters: 4
	},
	'TIT': {
		name: 'Titus',
		chapters: 3
	},
	'PHM': {
		name: 'Philemon',
		chapters: 1
	},
	'HEB': {
		name: 'Hebrews',
		chapters: 13
	},
	'JAS': {
		name: 'James',
		chapters: 5
	},
	'1PE': {
		name: '1 Peter',
		chapters: 5
	},
	'2PE': {
		name: '2 Peter',
		chapters: 3
	},
	'1JN': {
		name: '1 John',
		chapters: 5
	},
	'2JN': {
		name: '2 John',
		chapters: 1
	},
	'3JN': {
		name: '3 John',
		chapters: 1
	},
	'JUD': {
		name: 'Jude',
		chapters: 1
	},
	'REV': {
		name: 'Revelation',
		chapters: 22
	},
}

export const texts = {
	'en_ult': 'unfoldingWord® Literal Text',
	'en_ust': 'unfoldingWord® Simplified Text',
}

export type BookNames = keyof typeof books

export const bookNames = {
	'gen': 'Genesis',
	'exo': 'Exodus',
	'lev': 'Leviticus',
	'num': 'Numbers',
	'deu': 'Deuteronomy',
	'jos': 'Joshua',
	'jdg': 'Judges',
	'rut': 'Ruth',
	'1sa': '1 Samuel',
	'2sa': '2 Samuel',
	'1ki': '1 Kings',
	'2ki': '2 Kings',
	'1ch': '1 Chronicles',
	'2ch': '2 Chronicles',
	'ezr': 'Ezra',
	'neh': 'Nehamiah',
	'est': 'Esther',
	'job': 'Job',
	'psa': 'Psalm',
	'pro': 'Proverbs',
	'ecc': 'Ecclessiates',
	'sng': 'Song of Solomon',
	'isa': 'Isiah',
	'jer': 'Jeremiah',
	'lam': 'Lamentations',
	'ezk': 'Ezekiel',
	'dan': 'Daniel',
	'hos': 'Hosea',
	'jol': 'Joel',
	'amo': 'Amos',
	'oba': 'Obadiah',
	'jon': 'Jonah',
	'mic': 'Micah',
	'nam': 'Nahum',
	'hab': 'Habakkuk',
	'zep': 'Zephaniah',
	'hag': 'Haggai',
	'zec': 'Zechariah',
	'mal': 'Malachi',
	'mat': 'Matthew',
	'mrk': 'Mark',
	'luk': 'Luke',
	'jhn': 'John',
	'act': 'Acts',
	'rom': 'Romans',
	'1co': '1 Corinthians',
	'2co': '2 Corinthians',
	'gal': 'Galatians',
	'eph': 'Ephesians',
	'php': 'Philippians',
	'col': 'Colossians',
	'1th': '1 Thessalonians',
	'2th': '2 Thessalonians',
	'1ti': '1 Timothy',
	'2ti': '2 Timothy',
	'tit': 'Titus',
	'phm': 'Philemon',
	'heb': 'Hebrews',
	'jas': 'James',
	'1pe': '1 Peter',
	'2pe': '2 Peter',
	'1jn': '1 John',
	'2jn': '2 John',
	'3jn': '3 John',
	'jud': 'Jude',
	'rev': 'Revelation',
};

export type BookId = keyof typeof bookNames;

export async function getChapter(version: string, book: BookId, chapter: number): Promise<string> {
	const path = getChapterPath(version, book, chapter);
	return fetch(path)
		.then(res => {
			if (res.ok) return res.text();
			return 'Error: ' + res.status + '\n' + path;
		})
		.catch(e => {
			return `<pre>${e.stack}</pre>`;
		});
}

export function getChapterPath(version: string, book: BookId, chapter: number) {
	const chap = (chapter + '').padStart(3, '0');
	return `${import.meta.env['OPENBIBLE_STATIC_URL']}/bibles/${version}/${book}/${chap}.html`;
}

// Downloads per-chapter mp3 files to `outdir`.
import { downloadFile, type BookId } from "@openbible/core";
import { join } from "node:path";

const outdir = "downloads";
const dateRe = /\d{4}-\d{2}-\d{2}/g;
// TODO: compute from text
type Book = [book: BookId, chapters: number, verses: number];
const books: Book[] = [
	["gen", 50, 1533],
	["exo", 40, 1213],
	["lev", 27, 859],
	["num", 36, 1288],
	["deu", 34, 959],
	["jos", 24, 658],
	["jdg", 21, 618],
	["rut", 4, 85],
	["1sa", 31, 810],
	["2sa", 24, 695],
	["1ki", 22, 816],
	["2ki", 25, 719],
	["1ch", 29, 942],
	["2ch", 36, 822],
	["ezr", 10, 280],
	["neh", 13, 406],
	["est", 10, 167],
	["job", 42, 1070],
	["psa", 150, 2461],
	["pro", 31, 915],
	["ecc", 12, 222],
	["sng", 8, 117],
	["isa", 66, 1292],
	["jer", 52, 1364],
	["lam", 5, 154],
	["ezk", 48, 1273],
	["dan", 12, 357],
	["hos", 14, 197],
	["jol", 3, 73],
	["amo", 9, 146],
	["oba", 1, 21],
	["jon", 4, 48],
	["mic", 7, 105],
	["nam", 3, 47],
	["hab", 3, 56],
	["zep", 3, 53],
	["hag", 2, 38],
	["zec", 14, 211],
	["mal", 4, 55],
	["mat", 28, 1071],
	["mrk", 16, 678],
	["luk", 24, 1151],
	["jhn", 21, 879],
	["act", 28, 1007],
	["rom", 16, 433],
	["1co", 16, 437],
	["2co", 13, 257],
	["gal", 6, 149],
	["eph", 6, 155],
	["php", 4, 104],
	["col", 4, 95],
	["1th", 5, 89],
	["2th", 3, 47],
	["1ti", 6, 113],
	["2ti", 4, 83],
	["tit", 3, 46],
	["phm", 1, 25],
	["heb", 13, 303],
	["jas", 5, 108],
	["1pe", 5, 105],
	["2pe", 3, 61],
	["1jn", 5, 105],
	["2jn", 1, 13],
	["3jn", 1, 14],
	["jud", 1, 25],
	["rev", 22, 404],
];

function padStart(n: number, width: number) {
	return n.toString().padStart(width, "0");
}

function titleCase(s: string) {
	if (s[0] >= "0" && s[0] <= "9") {
		return s[0] + s[1].toUpperCase() + s.substring(2);
	}
	return s[0].toUpperCase() + s.substring(1);
}

export const mirrors = {
	"https://openbible.com": (
		speaker: string,
		book?: BookId,
		chapter?: number,
	) => {
		let res = `/audio/${speaker}`;
		if (!book) return res;

		res += "/BSB_";
		const i = books.findIndex(b => b[0] === book);
		if (book === "tit") book = "tts" as "tit";
		if (!chapter) return res;
		res += `${padStart(i + 1, 2)}_${titleCase(book)}_${padStart(chapter, 3)}`;
		if (speaker !== "souer") res += `_${speaker[0].toUpperCase()}`;
		res += ".mp3";
		return res;
	},
	// Re-encoded for slightly smaller filesizes. Missing `gilbert`.
	"https://tim.z73.com": (
		speaker: string,
		book?: BookId,
		chapter?: number,
	) => {
		let res = `/${speaker}/audio`;
		if (!book) return res;

		res += `/${titleCase(book)}`;
		if (!chapter) return res;
		res += padStart(chapter, book === "psa" ? 3 : 2);
		res += ".mp3";
		return res;
	},
} as const;

export async function downloadSpeaker(
	mirror: keyof typeof mirrors,
	speaker: string,
	since?: string,
) {
	// if there's a new speaker, will redownload ALL
	const url = mirror + mirrors[mirror](speaker);
	const resp = await fetch(url);
	if (!resp.ok) throw Error(`${resp.status} downloading ${url}`);
	const text = await resp.text();
	let lastUpdated = "1990-01-01";
	for (const m of text.matchAll(dateRe)) {
		if (m[0] > lastUpdated) lastUpdated = m[0];
	}
	console.log(url, "last updated", lastUpdated);
	if (since && lastUpdated < since) return;

	for (const [book, nChapters] of books) {
		if (!nChapters) {
			console.warn("skipping", book, "due to unknown number of chapters");
			continue;
		}

		for (let i = 0; i < nChapters; i++) {
			const chapter = i + 1;
			const url = mirror + mirrors[mirror](speaker, book as BookId, chapter);
			const fname = join(outdir, speaker, book, `${padStart(chapter, 3)}.mp3`);

			await downloadFile(url, fname);

			const args = [
				"-hide_banner", "-loglevel", "warning", // less clutter
				"-y", // overwrite output file
				"-i", fname, // input file
				"-map_metadata", "-1", // remove audio metadata
				"-b:a", "32k", // target 32k bitrate
				`${fname}.webm`, // output file
			];
		}
	}
}

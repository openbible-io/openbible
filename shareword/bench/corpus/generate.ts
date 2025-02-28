// Use BSB's English, Hebrew OT, and Greek NT.
import { type BookId, isNewTestament } from "@openbible/core";
import { fname, downloadDir, parseRow } from "@openbible/bsb/build";
import ExcelJS, { type Worksheet } from "exceljs";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";

const files = {
	en: createWriteStream(join(import.meta.dir, "en.txt")),
	he: createWriteStream(join(import.meta.dir, "he.txt")),
	gr: createWriteStream(join(import.meta.dir, "gr.txt")),
};

type Verse = {
	book: BookId;
	chapter: number;
	verse: string;
	rows: NonNullable<ReturnType<typeof parseRow>>[];
};

function flushVerse(verse: Verse) {
	// make source for translation mapping
	const sorted = verse.rows.toSorted((a, b) => a.sourceOrder - b.sourceOrder);

	const writeStream = isNewTestament(verse.book) ? files.gr : files.he;
	for (const r of sorted) writeStream.write(r.source, "utf8");
	if (sorted[0].source) writeStream.write("\n");

	for (const r of verse.rows) {
		if (!r.text || r.text === "-") continue; // untranslated
		if (r.text === ". . ." || r.text === "vvv") continue; // before/after

		files.en.write(r.joined, "utf8");
	}
	files.en.write("\n");
}

async function parseWorksheet(ws: ExcelJS.stream.xlsx.WorksheetReader) {
	// Parse a verse at a time so that both `source` and `translation` can
	// include book, chapter, and verse references.
	let verse: Verse | undefined;
	let lastVerse: Verse = {
		book: "gen",
		chapter: 0,
		verse: "",
		rows: [],
	};
	console.log(lastVerse.book);
	for await (const row of ws) {
		if (row.number === 1) continue; // header row

		const parsed = parseRow(row);
		if (!parsed) continue;

		// (ab)use fact parsed.bcv only appears on new verses.
		if (parsed.bcv) {
			if (verse) {
				if (lastVerse.book !== verse.book) console.log(verse.book);
				flushVerse(verse);
				lastVerse = verse;
			}
			verse = { ...parsed.bcv, rows: [] };
		}
		if (!verse) continue;

		verse.rows.push(parsed);
	}
	if (verse) flushVerse(verse);
}

async function mainWorksheet(fname: string) {
	for await (const worksheet of new ExcelJS.stream.xlsx.WorkbookReader(
		fname,
		{},
	)) {
		const w = worksheet as unknown as Worksheet;
		if (w.name === "biblosinterlinear96") return worksheet;
	}
	throw Error("could not find main worksheet");
}

async function parseSpreadsheet(fname: string) {
	const interlinear = await mainWorksheet(fname);
	await parseWorksheet(interlinear);
}

const dir = dirname(
	import.meta.resolve("@openbible/bsb/package.json").replace("file://", ""),
);
const xlsx = join(dir, downloadDir, fname);
console.log(xlsx);
await parseSpreadsheet(xlsx);
Object.values(files).forEach((f) => f.close());

import {
	type BookId,
	bookFromEnglish,
	type Translation,
	type Ref,
} from "@openbible/models";
import ExcelJS, { type CellValue, type Worksheet } from "exceljs";
import { writeFile } from "node:fs/promises";
//import { encode } from 'cbor-x';
import { Encoder } from "cbor-x";
const encoder = new Encoder({
	pack: true,
});
//import {  CborEncoder } from "@jsonjoy.com/json-pack/lib/cbor/CborEncoder";
//const encoder = new CborEncoder();

type Books = {
	[book in BookId]?: {
		source: Translation;
		translation: Translation;
	};
};

function parseRow(row: ExcelJS.Row) {
	const [
		_,
		hebSort,
		greekSort,
		_bsbSort,
		_verse,
		lang,
		_source1,
		source2, // WLC / Nestle Base {TR} ⧼RP⧽ (WH) 〈NE〉 [NA] ‹SBL› [[ECM]]
		_translit,
		parsing1,
		_parsing2,
		strongHeb,
		strongGrk,
		verseRef,
		headingFmt,
		_xref,
		paraFmt,
		__,
		before,
		text,
		after,
		after2,
		_footnotes,
		after3,
	] = row.values as CellValue[];

	if (!source2) return;

	let bcv:
		| {
				book: BookId;
				chapter: number;
				verse: string;
		  }
		| undefined;
	if (verseRef) {
		const match = verseRef.toString().match(/^(.*) (\d+):(\d+)$/);
		if (!match) {
			console.error("invalid verse", verseRef, "at row", row.number);
			return;
		}
		const book = bookFromEnglish(match[1]);
		bcv = {
			book,
			chapter: Number.parseInt(match[2]),
			verse: match[3],
		};
	}

	const headings: Translation = [];
	if (headingFmt) {
		//<p class=|hdg|>The Creation
		//<p class=|subhdg|>The First Day
		const re = /<p class=\|([^\|]+)\|>([^<]*)/g;
		let match: RegExpExecArray | null;
		const s = headingFmt.toString();
		while ((match = re.exec(s)) != null) {
			//if (match[2]) console.log(match[1]);
			//3016 hdg
			//  37 ihdg - italic heading (speakers in song of solomon)
			//  42 subhdg - subheading
			//  22 acrostic
			//   5 suphdg - psalm book number
			//   5 pshdg - psalm heading (i.e. Psalm 1-31)
			if (match[1] === "hdg" || match[1] === "ihdg") {
				headings.push({ h3: match[2] });
			} else if (match[1] === "subhdg") {
				headings.push({ h4: match[2] });
			}
		}
	}
	const paragraphs: Translation = [];
	if (paraFmt) {
		const re = /<p class=\|([^\|]+)\|>/g;
		let match: RegExpExecArray | null;
		const s = paraFmt.toString();
		while ((match = re.exec(s)) != null) {
			// console.log(match[1]);
			//  22 acrostic
			//3016 hdg
			//  37 ihdg
			//8269 indent1
			//3286 indent1stline
			//  31 indent1stlinered
			//12476 indent2
			//  40 indentred1
			//  70 indentred2
			//   4 inscrip
			// 972 list1
			// 371 list1stline
			//  29 list2
			// 122 pshdg
			// 459 red
			//11822 reg
			// 223 selah
			//  43 subhdg
			//   5 suphdg
			//  12 tab1
			// 188 tab1stline
			//  32 tab1stlinered
			if (
				[
					"tab1stline",
					"tab1stlinered",
					"indent1stline",
					"indent1stlinered",
					"indent1",
					"list1",
					"list1stline",
					"tab1",
				].includes(match[1])
			) {
				paragraphs.push({ p: "tab1" });
			} else if (["indent2", "indentred2", "list2"].includes(match[1])) {
				paragraphs.push({ p: "tab2" });
			} else {
				paragraphs.push({ p: "" });
			}
		}
	}
	if (typeof greekSort !== "number" || typeof hebSort !== "number") {
		console.error("invalid sort values", greekSort, hebSort);
		return;
	}
	if (typeof source2 !== "string") {
		console.error("invalid source value", source2);
		return;
	}

	return {
		i: row.number,
		lang,
		sourceOrder: greekSort + hebSort, // (ab)use fact greekSort == 0 in OT and hebSort is 999999 for greek
		source: source2,
		lemma: strongHeb?.toString() ?? strongGrk?.toString(),
		parsing: parsing1?.toString(),
		bcv,
		headings,
		paragraphs,
		text: (text ?? "").toString().trim(),
		joined: [before, (text ?? "").toString().trim(), after, after2, after3]
			.filter((t) => typeof t === "string")
			.concat(" ")
			.join(""),
	};
}

function toShort(text: string, ref: Ref) {
	return text
		.split(/\[|\]/)
		.map((s, i) => ({ text: s, ref, ...(i % 2 ? { class: "smoothing" } : {}) }))
		.filter(({ text }) => Boolean(text));
}

type Verse = {
	book: BookId;
	chapter: number;
	verse: string;
	rows: NonNullable<ReturnType<typeof parseRow>>[];
};

function flushVerse(res: Books, verse: Verse, prevVerse: Omit<Verse, "rows">) {
	const data = res[verse.book] ?? { source: [], translation: [] };
	res[verse.book] = data;

	if (verse.book !== prevVerse.book) {
		data.source.push({ b: verse.book });
		data.translation.push({ b: verse.book });
	}
	if (verse.chapter !== prevVerse.chapter) {
		data.source.push({ c: verse.chapter });
		data.translation.push({ c: verse.chapter });
	}
	data.source.push({ v: verse.verse });
	data.translation.push(...(verse.rows?.[0]?.headings ?? []));
	data.translation.push(...(verse.rows?.[0]?.paragraphs ?? []));
	data.translation.push({ v: verse.verse });

	// 1. make source for translation mapping
	const sorted = verse.rows.toSorted((a, b) => a.sourceOrder - b.sourceOrder);

	for (const r of sorted) {
		data.source.push({
			text: r.source,
			...(r.lemma ? { lemma: r.lemma } : {}),
			...(r.parsing ? { parsing: r.parsing } : {}),
		});
		r.sourceOrder = data.source.length;
	}

	let ref: Ref = -1;
	for (const r of verse.rows) {
		if (!r.text || r.text === "-") continue; // untranslated

		if (r.text === ". . .") {
			if (ref === -1) {
				console.warn(
					`"${r.text}" across verse boundary loses context at row`,
					r.i,
				);
				continue;
			}
			// this and previous source word map to previous translated word
			if (typeof ref === "number") ref = { from: ref, to: r.sourceOrder };
			continue;
		}
		if (r.text === "vvv") {
			// next translated word captures this word's meaning
			if (typeof ref === "number") ref = { from: ref, to: ref };
			ref.to = r.sourceOrder;
			continue;
		}
		if (typeof ref === "object") {
			ref.to = r.sourceOrder;
		} else {
			ref = r.sourceOrder;
		}

		for (const short of toShort(r.joined, ref)) data.translation.push(short);
	}
}

async function parseWorksheet(
	ws: ExcelJS.stream.xlsx.WorksheetReader,
): Promise<Books> {
	const res: Books = {};

	// Parse a verse at a time so that both `source` and `translation` can
	// include book, chapter, and verse references.
	let verse: Verse | undefined;
	let lastVerse: Verse = {
		book: "gen",
		chapter: 0,
		verse: "",
		rows: [],
	};
	for await (const row of ws) {
		if (row.number === 1) continue; // header row

		const parsed = parseRow(row);
		if (!parsed) continue;

		// (ab)use fact parsed.bcv only appears on new verses.
		if (parsed.bcv) {
			if (verse) {
				flushVerse(res, verse, lastVerse);
				lastVerse = verse;
			}
			verse = { ...parsed.bcv, rows: [] };
		}
		if (!verse) continue;

		verse.rows.push(parsed);
	}
	if (verse) flushVerse(res, verse, verse);

	return res;
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

export async function parseSpreadsheet(fname: string) {
	const interlinear = await mainWorksheet(fname);
	return await parseWorksheet(interlinear);
}

const books = await parseSpreadsheet("./downloads/bsb_tables.xlsx");
await writeFile("test.cbor2", encoder.encode(books));
await writeFile("test.json", JSON.stringify(books));

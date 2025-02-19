// Downloads per-chapter mp3 files to `outdir`.
import type { BookId, Publication } from "@openbible/core";
import { copy, readerFromStreamReader } from "@std/io";
import { dirname, join } from "node:path";
import { outdir } from "./config.ts";

const dateRe = /\d{4}-\d{2}-\d{2}/g;

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
		pub: Publication,
		version: string,
		book?: BookId,
		chapter?: number,
	) => {
		let res = `/audio/${version}`;
		if (!book) return res;

		res += "/BSB_";
		const i = Object.keys(pub.books).indexOf(book);
		if (book == "tit") book = "tts" as "tit";
		if (!chapter) return res;
		res += `${padStart(i + 1, 2)}_${titleCase(book)}_${padStart(chapter, 3)}`;
		if (version != "souer") res += `_${version[0].toUpperCase()}`;
		res += ".mp3";
		return res;
	},
	// Re-encoded for slightly smaller filesizes. Missing `gilbert`.
	"https://tim.z73.com": (
		_pub: Publication,
		version: string,
		book?: BookId,
		chapter?: number,
	) => {
		let res = `/${version}/audio`;
		if (!book) return res;

		res += `/${titleCase(book)}`;
		if (!chapter) return res;
		res += padStart(chapter, book == "psa" ? 3 : 2);
		res += ".mp3";
		return res;
	},
} as const;

async function downloadVersion(
	pub: Publication,
	mirror: keyof typeof mirrors,
	version: string,
	since?: string,
) {
	// if there's a new version, will redownload ALL
	const url = mirror + mirrors[mirror](pub, version);
	const resp = await fetch(url);
	if (!resp.ok) throw Error(`${resp.status} downloading ${url}`);
	const text = await resp.text();
	let lastUpdated = "1990-01-01";
	for (const m of text.matchAll(dateRe)) {
		if (m[0] > lastUpdated) lastUpdated = m[0];
	}
	console.log(url, "last updated", lastUpdated);
	if (since && lastUpdated < since) return;

	for (const e of Object.entries(pub.books)) {
		const [book, { data }] = e;
		const nChapters = data?.ast
			.findLast((n) => typeof n == "object" && ("chapter" in n))
			?.chapter;

		if (!nChapters) {
			console.warn("skipping", book, "due to unknown number of chapters");
			continue;
		}

		for (let i = 0; i < nChapters; i++) {
			const chapter = i + 1;
			const url = mirror +
				mirrors[mirror](version, book as BookId, chapter);
			const fname = join(outdir, version, book, `${padStart(chapter, 3)}.mp3`);
			console.log(url, "->", fname);

			const resp = await fetch(url);
			if (!resp.ok) throw Error(`${resp.status} downloading ${url}`);
			const rdr = resp.body?.getReader();
			if (!rdr) throw Error("no response body " + url);
			const r = readerFromStreamReader(rdr);

			await Deno.mkdir(dirname(fname), { recursive: true });
			const f = await Deno.open(fname, { create: true, write: true });
			await copy(r, f);
			const mtime = new Date(lastUpdated);
			Deno.utimeSync(fname, mtime, mtime);
			f.close();
		}
	}
}

export async function download(
	pub: Publication,
	mirror: keyof typeof mirrors,
	since?: string,
) {
}

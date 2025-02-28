import { Command, Option } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
//import { mirrors } from "./audio.ts";
import { join } from "node:path";
import ProgressBar from "progress";

export const fname = "bsb_tables.xlsx";
export const downloadDir = "downloads";

/**
 * Download a file to a path with a progress bar.
 */
export async function downloadFile(url: string, path: string) {
	console.log(url);
	const file = createWriteStream(path);
	const resp = await fetch(url);

	const contentLength = resp.headers.get("content-length");
	if (!contentLength) throw `${url} missing content-length`;

	const total = Number.parseInt(contentLength);
	const progress = new ProgressBar(":bar :percent (:eta remaining)", {
		total,
		width: url.length,
	});
	if (!resp.body) throw `${url} missing body`;

	const reader = resp.body.getReader();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		progress.tick(value.length);
		file.write(value);
	}
	file.end();
	file.close();
}

if (import.meta.main) {
	const program = new Command();

	program
		.command("text")
		.description(`download latest ${fname}`)
		.action(async () => {
			await mkdir(downloadDir, { recursive: true });
			const path = join(downloadDir, fname);
			await downloadFile(`https://bereanbible.com/${fname}`, path);
		});

	//program.command("audio")
	//	.description("download latest audio")
	//	.option("-s, --since <date>", "download if changed after this date")
	//	.addOption(
	//		new Option("-m, --mirror <string>", "apache server mirror").choices(
	//			Object.keys(mirrors),
	//		).default(Object.keys(mirrors)[0]),
	//	)
	//	.action((str, opts) => {
	//		console.log(str, opts);
	//	});
	//
	program.parse();
}

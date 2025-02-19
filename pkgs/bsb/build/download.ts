import { downloadFile } from "@openbible/core";
import { Command, Option } from "commander";
//import { mirrors } from "./audio.ts";
import { join } from "node:path";

export const fname = "bsb_tables.xlsx";
export const downloadDir = "downloads";

if (import.meta.main) {
	const program = new Command();

	program.command("text")
		.description(`download latest ${fname}`)
		.action(async () => {
			await Deno.mkdir(downloadDir, { recursive: true });
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

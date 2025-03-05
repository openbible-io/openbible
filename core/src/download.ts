import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import ProgressBar from "progress";

/**
 * Download a url to a path with a progress bar.
 */
export async function downloadFile(url: string, path: string) {
	console.log(url, "->", path);
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

	await mkdir(dirname(path), { recursive: true });
	const file = createWriteStream(path);

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		progress.tick(value.length);
		file.write(value);
	}
	file.end();
	file.close();
}

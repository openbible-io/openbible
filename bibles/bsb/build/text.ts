import { join } from "node:path";
import { parseSpreadsheet } from "../src/parseSpreadsheet.ts";
import { downloadDir, fname } from "./download.ts";
import { mkdir, writeFile } from "node:fs/promises";

const genDir = "src/generated";
const path = join(downloadDir, fname);
const books = await parseSpreadsheet(path);

await mkdir(genDir, { recursive: true });

for (const [id, data] of Object.entries(books)) {
	const path = join(genDir, `${id}.json`);
	await writeFile(path, JSON.stringify(data, null, 2));
}

const indexPath = join(genDir, "index.ts");
await writeFile(
	indexPath,
	Object.keys(books)
		.map((id, i) => `import imp${i} from "./${id}.json" with { type: "json" };`)
		.concat('import type { Books } from "@openbible/core";')
		.concat("export default {")
		.concat(
			Object.keys(books)
				.map((b, i) => `"${b}": imp${i}`)
				.join(",\n"),
		)
		.concat("} as Books;")
		.join("\n"),
);

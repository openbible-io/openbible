import { join } from "node:path";
import { parseSpreadsheet } from "../src/parseSpreadsheet.ts";
import { downloadDir, fname } from "./download.ts";
import { writeHtml } from "@openbible/core";

const genDir = "src/generated";
const path = join(downloadDir, fname);

//const books = await parseSpreadsheet(path);

//await Deno.mkdir(genDir, { recursive: true });
//Object.entries(books).forEach(([id, { data }]) => {
//	const path = join(genDir, id + ".ts");
//	Deno.writeTextFileSync(
//		path,
//		`export default ${JSON.stringify(data, null, 2)};`,
//	);
//});
//
//const indexPath = join(genDir, "index.ts");
//Deno.writeTextFileSync(
//	indexPath,
//	Object.keys(books).map((id, i) => `import imp${i} from "./${id}.ts";`).join(
//		"\n",
//	),
//);
//Deno.writeTextFileSync(
//	indexPath,
//	`\nexport default {\n${
//		Object.keys(books).map((b, i) => `"${b}": imp${i}`).join(",\n")
//	}\n};`,
//	{ append: true },
//);

const pub = await import("../src/index.ts");
writeHtml(pub);

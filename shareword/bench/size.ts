import { languageSplices } from "./languageSplices";

const results = [];
const splices = languageSplices.en;
for (const lib of ["yjs", "diamond-types", "shareword"]) {
	const { createDoc, exportDoc } = await import(`./libs/${lib}`);

	const doc = createDoc(splices);
	const exported = exportDoc(doc);
	console.log(exported);
	results.push([lib, exported.length]);
}
console.table(results.sort((a, b) => a[1] - b[1]));

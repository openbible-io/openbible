import { do_not_optimize } from "mitata";
import { benchLib, type Splice } from "../harness";
import { Text as Doc } from "../../src/text";
import { encode } from "cbor-x";

export function createDoc(arr: Splice[]) {
	const doc = new Doc("a");

	for (const splice of arr) {
		if (splice.delCount) {
			doc.delete(splice.pos, splice.delCount);
		}

		doc.insert(splice.pos, splice.text);
	}

	return doc;
}

export function exportDoc(doc: ReturnType<typeof createDoc>) {
	return JSON.stringify(doc.oplog);
}

export default function run() {
	benchLib("shareword", (arr: Splice[]) =>
		do_not_optimize(exportDoc(createDoc(arr))),
	);
}

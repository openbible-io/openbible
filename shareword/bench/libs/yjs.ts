import { do_not_optimize } from "mitata";
import { benchLib, type Splice } from "../harness";
import * as Y from "yjs";

export function createDoc(arr: Splice[]) {
	const doc = new Y.Doc();
	const text = doc.getText("my-text");

	for (const splice of arr) {
		if (splice.delCount) {
			text.delete(splice.pos, splice.delCount);
		}

		text.insert(splice.pos, splice.text);
	}

	return doc;
}

export function exportDoc(doc: ReturnType<typeof createDoc>) {
	return Y.encodeStateAsUpdateV2(doc);
}

export default function run() {
	benchLib("yjs", (arr: Splice[]) =>
		do_not_optimize(exportDoc(createDoc(arr))),
	);
}

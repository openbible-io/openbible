import { do_not_optimize } from "mitata";
import { benchLib, type Splice } from "../harness";
import { Doc } from "diamond-types-node";

export function createDoc(arr: Splice[]) {
	const doc = new Doc("agent1");

	for (const splice of arr) {
		try {
			if (splice.delCount) {
				doc.del(splice.pos, splice.delCount);
			}
			doc.ins(splice.pos, splice.text);
		} catch (e) {
			// helps debug `generateSplices`
			console.error("problem slice", arr.indexOf(splice), splice);
			throw e;
		}
	}

	return doc;
}

export function exportDoc(doc: ReturnType<typeof createDoc>) {
	return doc.toBytes();
}

export default function run() {
	benchLib("diamond-types", (arr) => {
		const doc = createDoc(arr);
		const res = exportDoc(doc);

		doc.free(); // or sometimes crashes...
		return do_not_optimize(res);
	});
}

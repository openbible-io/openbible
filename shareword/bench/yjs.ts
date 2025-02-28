import { do_not_optimize } from "mitata";
import { benchLib, type Splice } from "./harness";
import * as Y from "yjs";

export default function run() {
	benchLib("yjs", (arr: Splice[]) => {
		const doc = new Y.Doc();
		const text = doc.getText("my-text");

		for (const splice of arr) {
			if (splice.delCount) {
				text.delete(splice.pos, splice.delCount);
			}

			text.insert(splice.pos, splice.text);
		}

		const res = text.toJSON();
		return do_not_optimize(res);
	});
}

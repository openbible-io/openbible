import { do_not_optimize } from "mitata";
import { benchLib, type Splice } from "./harness";
import { Text } from "../src/text";

export default function run() {
	benchLib("shareword", (arr: Splice[]) => {
		const text = new Text("a");

		for (const splice of arr) {
			if (splice.delCount) {
				text.delete(splice.pos, splice.delCount);
			}

			text.insert(splice.pos, splice.text);
		}

		const res = text.toString();
		return do_not_optimize(res);
	});
}

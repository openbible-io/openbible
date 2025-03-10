import { do_not_optimize } from "mitata";
import { benchLib, type Splice } from "../harness";
import Rope from "rope.js";

export default function run() {
	benchLib("rope", (arr: Splice[]) => {
		const doc = new Rope();

		for (const splice of arr) {
			doc.splice(splice.pos, splice.delCount, splice.text);
		}

		const res = doc.toString();
		return do_not_optimize(res);
	});
}

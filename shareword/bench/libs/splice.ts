import { do_not_optimize } from "mitata";
import { benchLib } from "./harness";
import type { Splice } from "./languageSplices";

export default function run() {
	benchLib("char splice", (arr: Splice[]) => {
		const text: string[] = [];

		for (const splice of arr) {
			if (splice.delCount) {
				text.splice(splice.pos, splice.delCount);
			}

			text.splice(splice.pos, 0, ...splice.text);
		}

		const res = text.join("");
		return do_not_optimize(res);
	});
}

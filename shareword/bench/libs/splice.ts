import { do_not_optimize } from "mitata";
import { benchLib, type Splice } from "../harness";

export default function run() {
	benchLib("char splice", (arr: Splice[]) => {
		const text: string[] = [];

		for (const splice of arr) {
			text.splice(splice.pos, splice.delCount, ...splice.text);
		}

		const res = text.join("");
		return do_not_optimize(res);
	});
}

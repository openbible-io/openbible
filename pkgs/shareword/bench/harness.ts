import { bench, summary, do_not_optimize } from "mitata";
import { dictionaries, type Dict } from "./corpus";
import * as Y from "yjs";
import * as dt from "diamond-types-node";

type Splice = { pos: number; delCount: number; text: string };

function pickWord(dict: Dict): string {
	const i = Math.floor(Math.random() * dict.length);
	return dict[i];
}

function generateSplices(dict: Dict, nOps: number): Splice[] {
	let pos = 0;
	let totalLen = 0;
	const res: Splice[] = [];

	for (let i = 0; i < nOps; i++) {
		const delCount = Math.min(
			totalLen - pos,
			Math.round(Math.random() < 0.05 ? Math.random() * 5 : 0),
		);
		const text = pickWord(dict);
		res.push({ pos, delCount, text });
		pos += text.length;
		totalLen += text.length;

		if (Math.random() < 0.15) {
			pos -= Math.round(Math.random() * 5);
			pos = Math.max(0, pos);
		}
	}

	return res;
}

// Generate these ahead of time to run benchmarks quickly.
console.log("sample splices");
const maxSplices = 100_000;
const spliceLens = [100, 1000, 10_000, maxSplices];
const languageSplices = Object.entries(dictionaries).reduce(
	(acc, [k, v]) => {
		acc[k] = generateSplices(v, maxSplices);
		console.log(
			k,
			acc[k]
				.slice(0, 10)
				.map((t) => t.text)
				.join(""),
		);
		return acc;
	},
	{} as { [lang: string]: Splice[] },
);

summary(() => {
	bench(
		"yjs $splices $lang ops",
		async function* (state: { get: (arg0: string) => number }) {
			const splices = languageSplices[state.get("lang")];
			if (!splices) throw `missing splices for lang ${state.get("lang")}`;

			yield {
				[0]() {
					return splices.slice(0, state.get("splices"));
				},

				bench(arr: Array<Splice>) {
					const doc = new Y.Doc();
					const text = doc.getText("my-text");

					for (const splice of arr) {
						if (splice.delCount) {
							text.delete(splice.pos, splice.delCount);
						}

						text.insert(splice.pos, splice.text);
					}

					return do_not_optimize(doc);
				},
			};
		},
	)
		.args("splices", spliceLens)
		.args("lang", Object.keys(dictionaries));

	bench(
		"diamond-types $splices $lang ops",
		async function*(state: { get: (arg0: string) => number }) {
			const splices = languageSplices[state.get("lang")];
			if (!splices) throw `missing splices for lang ${state.get("lang")}`;

			yield {
				[0]() {
					return splices.slice(0, state.get("splices"));
				},

				bench(arr: Array<Splice>) {
					const doc = new dt.Doc("agent1");

					for (const splice of arr) {
						try {
							if (splice.delCount) {
								doc.del(splice.pos, splice.delCount);
							}
						} catch (e) {
							console.error("problem slice", arr.indexOf(splice), splice, state);
							throw e;
						}

						doc.ins(splice.pos, splice.text);
					}

					return do_not_optimize(doc);
				},
			};
		},
	)
		.args("splices", spliceLens)
		.args("lang", Object.keys(dictionaries));
});

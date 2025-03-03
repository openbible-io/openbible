import { bench } from "mitata";
import corpuses from "./corpus/index";

export type Splice = { pos: number; delCount: number; text: string };

// PRNG for consistent runs.
export function mulberry32(seed: number): () => number {
	return () => {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const random = mulberry32(0);

// Standard Normal variate using Box-Muller transform.
function gaussianRandom(mean = 0, stdev = 1) {
	const u = 1 - random(); // Converting [0,1) to (0,1]
	const v = random();
	const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
	// Transform to the desired mean and standard deviation:
	return z * stdev + mean;
}

// We test documents longer than the Bible.
function substr(s: string, pos: number, len: number) {
	const wrapped = pos % s.length;
	return s.substring(wrapped, wrapped + len);
}

function generateSplices(corpus: string, nOps: number): Splice[] {
	let pos = 0;
	let totalLen = 0;
	const res: Splice[] = [];

	while (res.length < nOps) {
		const textLen = Math.round(gaussianRandom(40, 15));
		const text = substr(corpus, pos, Math.abs(textLen));

		if (textLen < 0) {
			// Simulate a typo
			const typoLen = -textLen;
			const typoOffset = Math.round(gaussianRandom(5, 5));
			if (typoOffset < 0) continue;

			const typo = text.split("").reverse().join("");
			res.push({ pos, delCount: 0, text: typo });
			pos += text.length;
			totalLen += text.length;

			// Possibly type a little more.
			const continuationLen = Math.round(gaussianRandom(5, 2));
			if (continuationLen > 0) {
				const continuation = substr(corpus, pos, continuationLen);
				res.push({ pos, delCount: 0, text: continuation });
				pos += continuationLen;
				totalLen += continuationLen;
			}
			// Fix the typo.
			pos -= continuationLen;
			pos -= text.length;
			res.push({ pos, delCount: typoLen, text });
			// Go back to the end.
			pos += continuationLen;
		} else if (textLen > 0) {
			res.push({ pos, delCount: 0, text });
			pos += text.length;
			totalLen += text.length;
		}
	}

	return res;
}

// Generate these ahead of time to run benchmarks quickly.
const spliceLens = [1e2, 1e5];
const maxSplices = Math.max(...spliceLens);
const languageSplices = Object.entries(corpuses).reduce(
	(acc, [lang, corpus]) => {
		acc[lang] = generateSplices(corpus, maxSplices);
		return acc;
	},
	{} as { [lang: string]: Splice[] },
);

type BenchFn = (arr: Splice[]) => void;

export function benchLib(name: string, fn: BenchFn): void {
	bench(
		`${name} $lang $splices ops`,
		async function* (state: { get: (arg0: string) => number }) {
			const splices = languageSplices[state.get("lang")];
			if (!splices) throw `missing splices for lang ${state.get("lang")}`;

			yield {
				[0]() {
					return splices.slice(0, state.get("splices"));
				},

				bench: fn,
			};
		},
	)
		.args("splices", spliceLens)
		.args("lang", Object.keys(languageSplices));
}

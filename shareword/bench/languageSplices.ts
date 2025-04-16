import corpuses from "./corpus/index";
import { mulberry32 } from "../src/fuzzer";

export type Splice = { pos: number; delCount: number; text: string };

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
export const spliceLens = [100_000];
const maxSplices = Math.max(...spliceLens);
export const languageSplices = Object.entries(corpuses).reduce(
	(acc, [lang, corpus]) => {
		acc[lang] = generateSplices(corpus, maxSplices);
		return acc;
	},
	{} as { [lang: string]: Splice[] },
);

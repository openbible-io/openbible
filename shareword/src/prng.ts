// PRNG for consisten runs. Is mulberry32:
// - https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
export function prng(seed: number): () => number {
	return () => {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}


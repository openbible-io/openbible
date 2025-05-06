import { test, expect } from "bun:test";
import { prng } from "../../prng";
import { BTree, toDot } from "./btree";
import { binarySearch } from "./bsearch";

test("correctness", () => {
	const random = prng(0);
	const comparator = (a: number, b: number) => a - b;
	const tree = new BTree<number, string>(
		(ctx, key) => {
			return {
				idx: binarySearch(ctx.keys, key, comparator, 0),
				offset: 0,
			};
		},
		10,
	);
	const map = new Map<number, string>();

	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	const length = 100;

	for (let i = 0; i < length; i++) {
		const k = random(); // assumption: unique
		const v = k.toString();

		map.set(k, v);
		tree.set(k, v);
		if (k > max) max = k;
		if (k < min) min = k;

		expect(tree.get(k)).toBe(v);
	}

	expect(tree.size).toBe(length);
	expect(tree.min()).toBe(min);
	expect(tree.max()).toBe(max);

	for (const [k, v] of map.entries()) expect(tree.get(k)).toBe(v);

	let last = 0;
	let i = 0;
	for (const n of tree.keys()) {
		expect(last).toBeLessThan(n);
		last = n;
		i++;
	}
	expect(i).toBe(length);
});

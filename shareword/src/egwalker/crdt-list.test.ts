import { test, expect } from "bun:test";
import { mulberry32 } from "../../fuzzer";
import BTree from "./btree";
import { refEncode } from "../op";

test("correctness", () => {
	const random = mulberry32(0);
	const bt = new BTree<number, string>((a, b) => a - b, 32);
	const map = new Map<number, string>();

	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	const length = 1000;

	for (let i = 0; i < length; i++) {
		const n = i ? random() : 0;
		map.set(n, n.toString());
		bt.set(n, n.toString());
		if (n > max) max = n;
		if (n < min) min = n;
	}

	expect(bt.length).toBe(map.size);
	expect(bt.min()).toBe(min);
	expect(bt.max()).toBe(max);

	for (const [k, v] of map.entries()) {
		expect(bt.get(k)).toBe(v);

		expect(bt.delete(k)).toBe(true);
		expect(bt.get(k)).toBeUndefined();
	}
	expect(bt.length).toBe(0);
});

test("custom comparator", () => {
	const random = mulberry32(0);
	const bt = new BTree<number, string>((a, b) => b - a);

	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	const length = 1000;

	for (let i = 0; i < length; i++) {
		const n = i ? random() : 0;
		bt.set(n, n.toString());
		if (n > max) max = n;
		if (n < min) min = n;
	}

	expect(bt.min()).toBe(max);
	expect(bt.max()).toBe(min);
});

test("deletion in middle of run", () => {
	const bt = new BTree();
	bt.insert(refEncode(0, 0), 0, "a".repeat(100));
	bt.delete(refEncode(1, 0), 50, 10);
	expect(debug(bt)).toEqual([
		{
			ref: [0, 0],
			len: 50,
			originLeft: -1,
			originRight: -1,
			deleted: false,
			curState: INSERTED,
		},
		{
			ref: [1, 0],
			len: 10,
			originLeft: [0, 49],
			originRight: -1,
			deleted: true,
			curState: DELETED,
		},
		{
			ref: [0, 59],
			len: 40,
			originLeft: [1, 0],
			originRight: -1,
			deleted: false,
			curState: INSERTED,
		},
	]);
	expect(bt.at(70)).toEqual({
		lv: 123 + 70,
		originLeft: -1,
		originRight: 123 + 71,
		deleted: false,
		curState: INSERTED,
	});
});

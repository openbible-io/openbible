import { test, expect } from "bun:test";
import { Text } from "./text";
import { debugRows2 } from "./egwalker/oplog";
import { fuzzer } from "./fuzzer";

test("correctness", () => {
	const a = new Text("a");
	const b = new Text("b");

	const aInsert = "hello";
	const bInsert = "world";

	a.insert(0, aInsert);
	b.insert(0, bInsert);

	const expectedFrontier = [
		aInsert.length - 1,
		aInsert.length + bInsert.length - 1,
	];
	a.merge(b);
	expect(debugRows2(a.oplog)).toEqual([
		["a0", 0, "hello", []],
		["b0", 0, "world", []],
	]);
	expect(a.oplog.stateVector).toEqual({ a: 5, b: 5 });
	expect(a.oplog.frontier).toEqual(expectedFrontier);

	b.merge(a);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "world", []],
		["a0", 0, "hello", []],
	]);
	expect(b.oplog.frontier).toEqual(expectedFrontier);

	let expected = "helloworld";
	expect(a.toString()).toBe(expected);
	expect(b.toString()).toBe(expected);

	a.delete("hellowor".length); // delete "l"
	b.delete(0, "hello".length);
	b.insert(0, "share");

	expect(debugRows2(a.oplog)).toEqual([
		["a0", 0, "hello", []],
		["b0", 0, "world", []],
		["a5", 8, -1, [4, 9]],
	]);
	expect(a.oplog.frontier).toEqual([10]);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "world", []],
		["a0", 0, "hello", []],
		["b5", 0, -5, [4, 9]],
		["b10", 0, "share", [14]],
	]);
	expect(b.oplog.frontier).toEqual([19]);

	expect(a.toString()).toBe("helloword");
	expect(b.toString()).toBe("shareworld");

	a.merge(b);
	expect(debugRows2(a.oplog)).toEqual([
		["a0", 0, "hello", []],
		["b0", 0, "world", []],
		["a5", 8, -1, [4, 9]],
		["b5", 0, -5, [4, 9]],
		["b10", 0, "share", [15]],
	]);
	expect(a.oplog.frontier).toEqual([10, 20]);

	b.merge(a);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "world", []],
		["a0", 0, "hello", []],
		["b5", 0, -5, [4, 9]],
		["b10", 0, "share", [14]],
		["a5", 8, -1, [4, 9]],
	]);
	expect(b.oplog.frontier).toEqual([19, 20]);

	expected = "shareword";
	expect(a.toString()).toBe(expected);
	expect(b.toString()).toBe(expected);
});

test("partial op merge", () => {
	const a = new Text("a");
	const b = new Text("b");

	b.insert(0, "vc");

	a.merge(b);
	expect(debugRows2(a.oplog)).toEqual([["b0", 0, "vc", []]]);
	expect(a.oplog.frontier).toEqual([1]);

	b.merge(a); // noop
	expect(debugRows2(b.oplog)).toEqual(debugRows2(a.oplog));
	expect(b.oplog.frontier).toEqual([1]);

	a.insert(2, "e");
	b.insert(2, "z"); // joined with previous run, only partially in a
	b.delete(1, 1);

	expect(debugRows2(a.oplog)).toEqual([
		["b0", 0, "vc", []],
		["a0", 2, "e", [1]],
	]);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "vcz", []],
		["b3", 1, -1, [2]],
	]);
	expect(a.oplog.frontier).toEqual([2]);
	expect(b.oplog.frontier).toEqual([3]);

	b.merge(a);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "vcz", []],
		["b3", 1, -1, [2]],
		["a0", 2, "e", [1]],
	]);
	expect(b.oplog.frontier).toEqual([3, 4]);

	a.merge(b);
	expect(debugRows2(a.oplog)).toEqual([
		["b0", 0, "vc", []],
		["a0", 2, "e", [1]],
		["b2", 2, "z", [1]], // tricky
		["b3", 1, -1, [3]],
	]);
	expect(a.oplog.frontier).toEqual([2, 4]);

	expect(a.toString()).toEqual("vez");
	expect(b.toString()).toEqual(a.toString());
});

test("frontiers", () => {
	const a = new Text("a");
	const b = new Text("b");
	const c = new Text("c");

	b.insert(0, "cr");
	b.insert(0, "o");
	a.merge(b);
	b.merge(a);
	expect(a.oplog.frontier).toEqual([2]);
	expect(b.oplog.frontier).toEqual([2]);

	a.insert(3, "m");
	a.delete(2, 1);
	a.insert(3, "w");
	b.merge(c);
	c.merge(b);
	expect(b.oplog.frontier).toEqual([2]);
	expect(c.oplog.frontier).toEqual([2]);

	a.delete(3, 1);
	a.insert(0, "df");
	b.insert(0, "gt");
	a.delete(0, 1);
	b.merge(a);
	a.merge(b);
	expect(a.oplog.frontier).toEqual([9, 11]);
	expect(b.oplog.frontier).toEqual([4, 11]);

	c.insert(0, "b");
	a.delete(2, 1);
	expect(a.oplog.frontier).toEqual([12]);
	c.merge(a);
	a.merge(c);
	expect(a.oplog.frontier).toEqual([12, 13]);
	expect(c.oplog.frontier).toEqual([3, 13]);
	expect(debugRows2(a.oplog)).toEqual([
		["b0", 0, "cr", []],
		["b2", 0, "o", [1]],
		["a0", 3, "m", [2]],
		["a1", 2, -1, [3]],
		["a2", 3, "w", [4]],
		["a3", 3, -1, [5]],
		["a4", 0, "df", [6]],
		["a6", 0, -1, [8]],
		["b3", 0, "gt", [2]],
		["a7", 2, -1, [9, 11]],
		["c0", 0, "b", [2]],
	]);
	expect(debugRows2(c.oplog)).toEqual([
		["b0", 0, "cr", []],
		["b2", 0, "o", [1]],
		["c0", 0, "b", [2]],
		["a0", 3, "m", [2]],
		["a1", 2, -1, [4]],
		["a2", 3, "w", [5]],
		["a3", 3, -1, [6]],
		["a4", 0, "df", [7]],
		["a6", 0, -1, [9]],
		["b3", 0, "gt", [2]],
		["a7", 2, -1, [10, 12]],
	]);

	a.delete(2, 2);
	a.merge(c);
	c.merge(a);
	expect(a.oplog.frontier).toEqual([15]);
	expect(c.oplog.frontier).toEqual([15]);
	expect(debugRows2(a.oplog)).toEqual([
		["b0", 0, "cr", []],
		["b2", 0, "o", [1]],
		["a0", 3, "m", [2]],
		["a1", 2, -1, [3]],
		["a2", 3, "w", [4]],
		["a3", 3, -1, [5]],
		["a4", 0, "df", [6]],
		["a6", 0, -1, [8]],
		["b3", 0, "gt", [2]],
		["a7", 2, -1, [9, 11]],
		["c0", 0, "b", [2]],
		["a8", 2, -2, [12, 13]],
	]);
	expect(debugRows2(c.oplog)).toEqual([
		["b0", 0, "cr", []],
		["b2", 0, "o", [1]],
		["c0", 0, "b", [2]],
		["a0", 3, "m", [2]],
		["a1", 2, -1, [4]],
		["a2", 3, "w", [5]],
		["a3", 3, -1, [6]],
		["a4", 0, "df", [7]],
		["a6", 0, -1, [9]],
		["b3", 0, "gt", [2]],
		["a7", 2, -1, [10, 12]],
		["a8", 2, -2, [3, 13]],
	]);

	expect(a.toString()).toEqual(c.toString());
});

test("convergence with fuzzer", () => {
	for (let i = 0; i < 100; i++) {
		fuzzer(i);
	}
});

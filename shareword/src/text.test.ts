import { test, expect } from "bun:test";
import { Text } from "./text";
import { debugRows2, toDot } from "./egwalker/oplog";
import { refDecode } from "./egwalker/op";
import { fuzzer } from "./fuzzer";
import { Patch } from "./egwalker/patch";

type LongOpRef = ReturnType<typeof refDecode>;
function expectFrontier(t: Text, expected: LongOpRef[]): void {
	expect(t.oplog.frontier.map(refDecode)).toEqual(expected);
	expect(t.branch.frontier.map(refDecode)).toEqual(expected);
}

test("correctness", async () => {
	const a = new Text("a");
	const b = new Text("b");

	const aInsert = "hello";
	const bInsert = "world";

	a.insert(0, aInsert);
	b.insert(0, bInsert);

	a.merge(b);
	expect(debugRows2(a.oplog)).toEqual([
		["a0", 0, "hello", []],
		["b0", 0, "world", []],
	]);
	expect(a.oplog.stateVector).toEqual({ a: 5, b: 5 });
	expectFrontier(a, [
		[0, 4],
		[1, 4],
	]);

	b.merge(a);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "world", []],
		["a0", 0, "hello", []],
	]);
	expectFrontier(b, [
		[0, 4],
		[1, 4],
	]);

	let expected = "helloworld";
	expect(a.toString()).toBe(expected);
	expect(b.toString()).toBe(expected);

	a.delete("hellowor".length); // delete "l"
	b.delete(0, "hello".length);
	b.insert(0, "share");

	expect(debugRows2(a.oplog)).toEqual([
		["a0", 0, "hello", []],
		["b0", 0, "world", []],
		[
			"a5",
			8,
			-1,
			[
				[0, 4],
				[1, 4],
			],
		],
	]);
	expectFrontier(a, [[2, 0]]);
	expect(a.toString()).toBe("helloword");

	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "world", []],
		["a0", 0, "hello", []],
		[
			"b5",
			0,
			-5,
			[
				[0, 4],
				[1, 4],
			],
		],
		["b10", 0, "share", [[2, 4]]],
	]);
	expectFrontier(b, [[3, 4]]);
	expect(b.toString()).toBe("shareworld");

	a.merge(b);
	expect(debugRows2(a.oplog)).toEqual([
		["a0", 0, "hello", []],
		["b0", 0, "world", []],
		[
			"a5",
			8,
			-1,
			[
				[0, 4],
				[1, 4],
			],
		],
		[
			"b5",
			0,
			-5,
			[
				[0, 4],
				[1, 4],
			],
		],
		["b10", 0, "share", [[3, 4]]],
	]);
	expectFrontier(a, [
		[2, 0],
		[4, 4],
	]);

	b.merge(a);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "world", []],
		["a0", 0, "hello", []],
		[
			"b5",
			0,
			-5,
			[
				[0, 4],
				[1, 4],
			],
		],
		["b10", 0, "share", [[2, 4]]],
		[
			"a5",
			8,
			-1,
			[
				[0, 4],
				[1, 4],
			],
		],
	]);
	expectFrontier(b, [
		[3, 4],
		[4, 0],
	]);

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
	expectFrontier(a, [[0, 1]]);

	b.merge(a); // noop
	expect(debugRows2(b.oplog)).toEqual(debugRows2(a.oplog));
	expectFrontier(b, [[0, 1]]);

	a.insert(2, "e");
	expect(debugRows2(a.oplog)).toEqual([
		["b0", 0, "vc", []],
		["a0", 2, "e", [[0, 1]]],
	]);
	expectFrontier(a, [[1, 0]]);
	expect(a.toString()).toEqual("vce");

	b.insert(2, "z"); // joined with previous run, only partially in a
	b.delete(1, 1);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "vcz", []],
		["b3", 1, -1, [[0, 2]]],
	]);
	expectFrontier(b, [[1, 0]]);
	expect(b.toString()).toEqual("vz");

	b.merge(a);
	expect(debugRows2(b.oplog)).toEqual([
		["b0", 0, "vcz", []],
		["b3", 1, -1, [[0, 2]]],
		["a0", 2, "e", [[0, 1]]],
	]);
	expectFrontier(b, [
		[1, 0],
		[2, 0],
	]);
	expect(b.toString()).toEqual("vez");

	a.merge(b);
	expect(debugRows2(a.oplog)).toEqual([
		["b0", 0, "vc", []],
		["a0", 2, "e", [[0, 1]]],
		["b2", 2, "z", [[0, 1]]], // tricky
		["b3", 1, -1, [[2, 0]]],
	]);
	expectFrontier(a, [
		[1, 0],
		[3, 0],
	]);
	expect(a.toString()).toEqual("vez");

	console.log(toDot(b.oplog))
});

test("frontiers", () => {
	const a = new Text("a");
	const b = new Text("b");
	const c = new Text("c");

	b.insert(0, "cr");
	b.insert(0, "o");
	a.merge(b);
	b.merge(a);
	expectFrontier(a, [[1, 0]]);
	expectFrontier(b, [[1, 0]]);

	a.insert(3, "m");
	a.delete(2, 1);
	a.insert(3, "w");
	b.merge(c);
	c.merge(b);
	expectFrontier(b, [[1, 0]]);
	expectFrontier(c, [[1, 0]]);

	a.delete(3, 1);
	a.insert(0, "df");
	a.delete(0, 1);
	b.insert(0, "gt");
	b.merge(a);
	a.merge(b);
	expectFrontier(a, [
		[7, 0],
		[8, 1],
	]);
	expectFrontier(b, [
		[2, 1],
		[8, 0],
	]);

	c.insert(0, "b");
	a.delete(2, 1);
	expectFrontier(a, [[9, 0]]);
	expectFrontier(c, [[2, 0]]);
	c.merge(a);
	a.merge(c);
	expect(a.oplog.frontier.map(refDecode)).toEqual([
		[9, 0],
		[10, 0],
	]);
	expect(c.oplog.frontier.map(refDecode)).toEqual([
		[2, 0],
		[10, 0],
	]);

	expect(a.toString()).toBe("fgbocm");
	a.delete(2, 2);
	a.merge(c);
	c.merge(a);
	expectFrontier(a, [[11, 1]]);
	expectFrontier(c, [[11, 1]]);

	expect(a.toString()).toEqual(c.toString());
});

test("convergence with fuzzer", () => {
	for (let seed = 0; seed < 100; seed++) {
		fuzzer(seed, (j, a, b) => {
			try {
				expect(a.toString()).toBe(b.toString());
			} catch (e) {
				console.log("bad", seed, j, a.toString(), b.toString());
				throw e;
			}
		});
	}
});

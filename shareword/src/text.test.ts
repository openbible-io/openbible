import { test, expect } from "bun:test";
import { Text } from "./text";
import { debugRows2} from "./egwalker/oplog";
import { mulberry32 } from "../bench/harness";
import { refDecode } from "./egwalker/op";

type LongOpRef = ReturnType<typeof refDecode>;
function expectFrontier(t: Text, expected: LongOpRef[]): void {
	expect(t.oplog.frontier.map(refDecode)).toEqual(expected);
	expect(t.branch.frontier.map(refDecode)).toEqual(expected);
}

function fuzzer(seed: number) {
	const random = mulberry32(seed);
	const randInt = (n: number) => Math.floor(random() * n);
	const randBool = (weight = 0.5) => random() < weight;

	const alphabet = "abcdefghijklmnopqrstuvwxyz";
	const randChar = () => alphabet[randInt(alphabet.length)];

	const docs = [new Text("a"), new Text("b"), new Text("c")];
	const randDoc = () => docs[randInt(docs.length)];

	// For debugging a test case.
	const toLogSeed = -1;
	const toLogI = -1;

	for (let i = 0; i < 100; i++) {
		//console.log(seed, i);
		for (let d = 0; d < 3; d++) {
			// 1. Pick a random document
			const doc = randDoc();
			const len = doc.snapshot.length;
			const insertWeight = len < 100 ? 0.65 : 0.35;

			// 2. Make a random change to that document
			if (len === 0 || randBool(insertWeight)) {
				const content = randChar();
				const pos = randInt(len + 1);
				if (seed === toLogSeed && i <= toLogI)
					console.log(`${doc.site}.insert(${pos}, "${content}")`);
				doc.insert(pos, content);
			} else {
				const pos = randInt(len);
				const delLen = Math.max(1, randInt(Math.min(len - pos, 3)));
				if (seed === toLogSeed && i <= toLogI)
					console.log(`${doc.site}.delete(${pos}, ${delLen})`);
				doc.delete(pos, delLen);
			}

			// doc.check()
		}

		// 3. merge 2 random docs
		const a = randDoc();
		const b = randDoc();

		if (a === b) continue;

		if (seed === toLogSeed && i <= toLogI)
			console.log(`${a.site}.merge(${b.site})`);
		a.merge(b);
		if (seed === toLogSeed && i <= toLogI)
			console.log(`${b.site}.merge(${a.site})`);
		b.merge(a);

		// 4. expect them to be the same
		try {
			expect(a.toString()).toBe(b.toString());
		} catch (e) {
			console.log("bad", seed, i, a.toString(), b.toString());
			//throw e;
		}
	}
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
	for (let i = 0; i < 100; i++) fuzzer(i);
});

import { test, expect } from "bun:test";
import { Text } from "./text";
import { debugPrint } from "./egwalker/oplog";
import { mulberry32 } from "../bench/harness";
import type { Accumulator, OpData } from "./egwalker/op";

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

type Row<T, AccT extends Accumulator<T>> = [
	id: string,
	pos: number,
	item: OpData<T, AccT>,
	parents: number[],
];
function toOplogRows(text: Text): Row<string, string>[] {
	const res: Row<string, string>[] = [];

	const oplog = text.oplog;
	for (let i = 0; i < oplog.length; i++) {
		res.push([
			`${oplog.getSite(i)}${oplog.getClock(i)}`,
			oplog.getPos(i),
			oplog.getData(i),
			oplog.getParents(i),
		]);
	}

	return res;
}

test("correctness", () => {
	const a = new Text("a");
	const b = new Text("b");

	const aInsert = "hello";
	const bInsert = "world";

	a.insert(0, aInsert);
	b.insert(0, bInsert);

	a.merge(b);
	b.merge(a);

	const expectedFrontier = [
		aInsert.length - 1,
		aInsert.length + bInsert.length - 1,
	];
	expect(toOplogRows(a)).toEqual([
		["a0", 0, "h", []],
		["a1", 1, "e", [0]],
		["a2", 2, "l", [1]],
		["a3", 3, "l", [2]],
		["a4", 4, "o", [3]],
		["b0", 0, "w", []],
		["b1", 1, "o", [5]],
		["b2", 2, "r", [6]],
		["b3", 3, "l", [7]],
		["b4", 4, "d", [8]],
	]);
	expect(a.oplog.frontier).toEqual(expectedFrontier);

	expect(toOplogRows(b)).toEqual([
		["b0", 0, "w", []],
		["b1", 1, "o", [0]],
		["b2", 2, "r", [1]],
		["b3", 3, "l", [2]],
		["b4", 4, "d", [3]],
		["a0", 0, "h", []],
		["a1", 1, "e", [5]],
		["a2", 2, "l", [6]],
		["a3", 3, "l", [7]],
		["a4", 4, "o", [8]],
	]);
	expect(b.oplog.frontier).toEqual(expectedFrontier);

	let expected = "helloworld";
	expect(a.toString()).toBe(expected);
	expect(b.toString()).toBe(expected);

	a.delete("hellowor".length); // delete "l"
	b.delete(0, "hello".length);
	b.insert(0, "share");

	expect(toOplogRows(a).slice(10)).toEqual([["a5", 8, -1, [4, 9]]]);
	expect(a.oplog.frontier).toEqual([10]);
	expect(toOplogRows(b).slice(10)).toEqual([
		["b5", 0, -1, [4, 9]],
		["b6", 0, -1, [10]],
		["b7", 0, -1, [11]],
		["b8", 0, -1, [12]],
		["b9", 0, -1, [13]],
		["b10", 0, "s", [14]],
		["b11", 1, "h", [15]],
		["b12", 2, "a", [16]],
		["b13", 3, "r", [17]],
		["b14", 4, "e", [18]],
	]);
	expect(b.oplog.frontier).toEqual([19]);

	a.merge(b);
	b.merge(a);

	expect(toOplogRows(a).slice(10)).toEqual([
		["a5", 8, -1, [4, 9]],
		["b5", 0, -1, [4, 9]],
		["b6", 0, -1, [11]],
		["b7", 0, -1, [12]],
		["b8", 0, -1, [13]],
		["b9", 0, -1, [14]],
		["b10", 0, "s", [15]],
		["b11", 1, "h", [16]],
		["b12", 2, "a", [17]],
		["b13", 3, "r", [18]],
		["b14", 4, "e", [19]],
	]);
	expect(a.oplog.frontier).toEqual([10, 20]);
	expect(toOplogRows(b).slice(10)).toEqual([
		["b5", 0, -1, [4, 9]],
		["b6", 0, -1, [10]],
		["b7", 0, -1, [11]],
		["b8", 0, -1, [12]],
		["b9", 0, -1, [13]],
		["b10", 0, "s", [14]],
		["b11", 1, "h", [15]],
		["b12", 2, "a", [16]],
		["b13", 3, "r", [17]],
		["b14", 4, "e", [18]],
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
	b.merge(a); // noop

	expect(toOplogRows(a)).toEqual([
		["b0", 0, "v", []],
		["b1", 1, "c", [0]],
	]);
	expect(toOplogRows(b)).toEqual(toOplogRows(a));
	expect(a.oplog.frontier).toEqual([1]);
	expect(b.oplog.frontier).toEqual([1]);

	a.insert(2, "e");
	b.insert(2, "z"); // joined with previous run, only partially in a
	b.delete(1, 1);

	expect(toOplogRows(a)).toEqual([
		["b0", 0, "v", []],
		["b1", 1, "c", [0]],
		["a0", 2, "e", [1]],
	]);
	expect(toOplogRows(b)).toEqual([
		["b0", 0, "v", []],
		["b1", 1, "c", [0]],
		["b2", 2, "z", [1]],
		["b3", 1, -1, [2]],
	]);
	expect(a.oplog.frontier).toEqual([2]);
	expect(b.oplog.frontier).toEqual([3]);
	b.merge(a);
	a.merge(b);

	expect(toOplogRows(a)).toEqual([
		["b0", 0, "v", []],
		["b1", 1, "c", [0]],
		["a0", 2, "e", [1]],
		["b2", 2, "z", [1]], // tricky
		["b3", 1, -1, [3]],
	]);
	expect(toOplogRows(b)).toEqual([
		["b0", 0, "v", []],
		["b1", 1, "c", [0]],
		["b2", 2, "z", [1]],
		["b3", 1, -1, [2]],
		["a0", 2, "e", [1]],
	]);
	expect(a.oplog.frontier).toEqual([2, 4]);
	expect(b.oplog.frontier).toEqual([3, 4]);

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
	expect(toOplogRows(a)).toEqual([
		["b0" ,0, "c",  []],
		["b1" ,1, "r",  [0]],
		["b2" ,0, "o",  [1]],
		["a0" ,3, "m",  [2]],
		["a1" ,2, -1,   [3]],
		["a2" ,3, "w",  [4]],
		["a3" ,3, -1,   [5]],
		["a4" ,0, "d",  [6]],
		["a5" ,1, "f",  [7]],
		["a6" ,0, -1,   [8]],
		["b3" ,0, "g",  [2]],
		["b4" ,1, "t",  [10]],
		["a7" ,2, -1,   [9, 11]],
		["c0" ,0, "b",  [2]],
	]);
	expect(toOplogRows(c)).toEqual([
		["b0" ,0, "c",  []],
		["b1" ,1, "r",  [0]],
		["b2" ,0, "o",  [1]],
		["c0" ,0, "b",  [2]],
		["a0" ,3, "m",  [2]],
		["a1" ,2, -1,   [4]],
		["a2" ,3, "w",  [5]],
		["a3" ,3, -1,   [6]],
		["a4" ,0, "d",  [7]],
		["a5" ,1, "f",  [8]],
		["a6" ,0, -1,   [9]],
		["b3" ,0, "g",  [2]],
		["b4" ,1, "t",  [11]],
		["a7" ,2, -1,   [10, 12]],
	]);

	a.delete(2, 2);
	a.merge(c);
	c.merge(a);
	expect(a.oplog.frontier).toEqual([15]);
	expect(c.oplog.frontier).toEqual([15]);
	expect(toOplogRows(a)).toEqual([
		["b0", 0, "c", []],
		["b1", 1, "r", [0]],
		["b2", 0, "o", [1]],
		["a0", 3, "m", [2]],
		["a1", 2, -1,  [3]],
		["a2", 3, "w", [4]],
		["a3", 3, -1,  [5]],
		["a4", 0, "d", [6]],
		["a5", 1, "f", [7]],
		["a6", 0, -1,  [8]],
		["b3", 0, "g", [2]],
		["b4", 1, "t", [10]],
		["a7", 2, -1,  [9, 11]],
		["c0", 0, "b", [2]],
		["a8", 2, -1,  [12, 13]],
		["a9", 2, -1,  [14]],
	]);
	expect(toOplogRows(c)).toEqual([
		["b0", 0, "c", []],
		["b1", 1, "r", [0]],
		["b2", 0, "o", [1]],
		["c0", 0, "b", [2]],
		["a0", 3, "m", [2]],
		["a1", 2, -1,  [4]],
		["a2", 3, "w", [5]],
		["a3", 3, -1,  [6]],
		["a4", 0, "d", [7]],
		["a5", 1, "f", [8]],
		["a6", 0, -1,  [9]],
		["b3", 0, "g", [2]],
		["b4", 1, "t", [11]],
		["a7", 2, -1,  [10, 12]],
		["a8", 2, -1,  [3, 13]],
		["a9", 2, -1,  [14]],
	]);

	expect(a.toString()).toEqual(c.toString());
});

test("convergence with fuzzer", () => {
	for (let i = 0; i < 100; i++) {
		fuzzer(i);
	}
});

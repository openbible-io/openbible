import { test, expect } from "bun:test";
import { Text } from "./text";
import { debugPrint } from "./egwalker/oplog";
import { mulberry32 } from "../bench/harness";

function fuzzer(seed: number) {
	const random = mulberry32(seed);
	const randInt = (n: number) => Math.floor(random() * n);
	const randBool = (weight = 0.5) => random() < weight;

	const alphabet = "abcdefghijklmnopqrstuvwxyz";
	const randChar = () => alphabet[randInt(alphabet.length)];

	const docs = [new Text("a"), new Text("b"), new Text("c")];
	const randDoc = () => docs[randInt(docs.length)];

	// For debugging a test case.
	const toLogSeed = 32;
	const toLogI = 9;

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
				const pos = randInt(len - 1);
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

type Row = [
	pos: number,
	op: string | number,
	site: string,
	clock: number,
	parents: number[],
];
function toOplogRows(text: Text): Row[] {
	const res: Row[] = [];

	const oplog = text.oplog;
	for (let i = 0; i < oplog.ops.length; i++) {
		const op = oplog.getOpData(i);

		res.push([
			oplog.getPos(i),
			typeof op === "number" ? 1 : oplog.getItem(i),
			oplog.getSite(i),
			oplog.getSiteClock(i),
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
	const expectedFrontier = [
		aInsert.length - 1,
		aInsert.length + bInsert.length - 1,
	];
	expect(toOplogRows(a)).toEqual([
		[0, "h", "a", 0, []],
		[1, "e", "a", 1, [0]],
		[2, "l", "a", 2, [1]],
		[3, "l", "a", 3, [2]],
		[4, "o", "a", 4, [3]],
		[0, "w", "b", 0, []],
		[1, "o", "b", 1, [5]],
		[2, "r", "b", 2, [6]],
		[3, "l", "b", 3, [7]],
		[4, "d", "b", 4, [8]],
	]);
	expect(a.oplog.frontier).toEqual(expectedFrontier);

	b.merge(a);
	expect(toOplogRows(b)).toEqual([
		[0, "w", "b", 0, []],
		[1, "o", "b", 1, [0]],
		[2, "r", "b", 2, [1]],
		[3, "l", "b", 3, [2]],
		[4, "d", "b", 4, [3]],
		[0, "h", "a", 0, []],
		[1, "e", "a", 1, [5]],
		[2, "l", "a", 2, [6]],
		[3, "l", "a", 3, [7]],
		[4, "o", "a", 4, [8]],
	]);
	expect(b.oplog.frontier).toEqual(expectedFrontier);

	let expected = "helloworld";
	expect(a.toString()).toBe(expected);
	expect(b.toString()).toBe(expected);

	a.delete("hellowor".length); // delete "l"
	b.delete(0, "hello".length);
	b.insert(0, "share");
	expect(toOplogRows(a).slice(10)).toEqual([[8, 1, "a", 5, [4, 9]]]);
	expect(a.oplog.frontier).toEqual([10]);
	expect(toOplogRows(b).slice(10)).toEqual([
		[0, 1, "b", 5, [4, 9]],
		[0, 1, "b", 6, [10]],
		[0, 1, "b", 7, [11]],
		[0, 1, "b", 8, [12]],
		[0, 1, "b", 9, [13]],
		[0, "s", "b", 10, [14]],
		[1, "h", "b", 11, [15]],
		[2, "a", "b", 12, [16]],
		[3, "r", "b", 13, [17]],
		[4, "e", "b", 14, [18]],
	]);
	expect(b.oplog.frontier).toEqual([19]);

	a.merge(b);
	expect(toOplogRows(a).slice(10)).toEqual([
		[8, 1, "a", 5, [4, 9]],
		[0, 1, "b", 5, [4, 9]],
		[0, 1, "b", 6, [11]],
		[0, 1, "b", 7, [12]],
		[0, 1, "b", 8, [13]],
		[0, 1, "b", 9, [14]],
		[0, "s", "b", 10, [15]],
		[1, "h", "b", 11, [16]],
		[2, "a", "b", 12, [17]],
		[3, "r", "b", 13, [18]],
		[4, "e", "b", 14, [19]],
	]);
	expect(a.oplog.frontier).toEqual([10, 20]);

	b.merge(a);
	expect(toOplogRows(b).slice(10)).toEqual([
		[0, 1, "b", 5, [4, 9]],
		[0, 1, "b", 6, [10]],
		[0, 1, "b", 7, [11]],
		[0, 1, "b", 8, [12]],
		[0, 1, "b", 9, [13]],
		[0, "s", "b", 10, [14]],
		[1, "h", "b", 11, [15]],
		[2, "a", "b", 12, [16]],
		[3, "r", "b", 13, [17]],
		[4, "e", "b", 14, [18]],
		[8, 1, "a", 5, [4, 9]],
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

	expect(toOplogRows(a)).toEqual([
		[0, "v", "b", 0, []],
		[1, "c", "b", 1, [0]],
	]);
	expect(a.oplog.frontier).toEqual([1]);

	b.merge(a); // noop
	expect(toOplogRows(b)).toEqual(toOplogRows(a));
	expect(b.oplog.frontier).toEqual([1]);

	a.insert(2, "e");
	b.insert(2, "z"); // joined with previous run, only partially in a
	b.delete(1, 1);

	expect(toOplogRows(a)).toEqual([
		[0, "v", "b", 0, []],
		[1, "c", "b", 1, [0]],
		[2, "e", "a", 0, [1]],
	]);
	expect(toOplogRows(b)).toEqual([
		[0, "v", "b", 0, []],
		[1, "c", "b", 1, [0]],
		[2, "z", "b", 2, [1]],
		[1, 1, "b", 3, [2]],
	]);
	expect(a.oplog.frontier).toEqual([2]);
	expect(b.oplog.frontier).toEqual([3]);

	a.merge(b);
	expect(toOplogRows(a)).toEqual([
		[0, "v", "b", 0, []],
		[1, "c", "b", 1, [0]],
		[2, "e", "a", 0, [1]],
		[2, "z", "b", 2, [1]], // tricky
		[1, 1, "b", 3, [3]],
	]);
	expect(a.oplog.frontier).toEqual([2, 4]);

	b.merge(a);
	expect(toOplogRows(b)).toEqual([
		[0, "v", "b", 0, []],
		[1, "c", "b", 1, [0]],
		[2, "z", "b", 2, [1]],
		[1, 1, "b", 3, [2]],
		[2, "e", "a", 0, [1]],
	]);
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
	expect(a.oplog.frontier).toEqual([2]);
	b.merge(a);
	expect(b.oplog.frontier).toEqual([2]);

	a.insert(3, "m");
	a.delete(2, 1);
	a.insert(3, "w");
	b.merge(c);
	expect(b.oplog.frontier).toEqual([2]);
	c.merge(b);
	expect(c.oplog.frontier).toEqual([2]);

	a.delete(3, 1);
	a.insert(0, "df");
	a.delete(0, 1);
	b.insert(0, "gt");

	//debugPrint(a.oplog);
	//debugPrint(b.oplog);
	//console.dir(a.oplog.diff(c.oplog.stateVector()), { depth: null });
	b.merge(a);
	expect(b.oplog.frontier).toEqual([4, 11]);
	a.merge(b);
	expect(a.oplog.frontier).toEqual([9, 11]);
	expect(a.toString()).toEqual(b.toString());

	c.insert(0, "b");
	a.delete(2, 1);
	expect(a.oplog.frontier).toEqual([12]);

	c.merge(a);
	expect(c.oplog.frontier).toEqual([3, 13]);
	a.merge(c);
	expect(a.oplog.frontier).toEqual([12, 13]);
	expect(a.toString()).toEqual(c.toString());

	a.delete(2, 2);

	a.merge(c);
	expect(a.oplog.frontier).toEqual([15]);
	c.merge(a);
	expect(c.oplog.frontier).toEqual([15]);

	expect(a.toString()).toEqual("fgcm");
	expect(c.toString()).toEqual("fgcm");
});

test("hangs", () => {
	const a = new Text("a");
	const b = new Text("b");
	const c = new Text("c");
	a.insert(0, "q");
	c.insert(0, "p");
	c.insert(0, "n");
	b.merge(a);
	a.merge(b);
	b.insert(1, "e");
	c.insert(0, "d");
	b.insert(2, "t");
	a.merge(b);
	b.merge(a);
	b.insert(2, "i");
	a.delete(0, 2);
	c.insert(3, "r");
	b.merge(a);
	a.merge(b);
	a.insert(2, "i");
	b.insert(1, "b");
	c.delete(0, 2);
	a.merge(b);
	b.merge(a);
	b.insert(0, "k");
	a.delete(3, 1);
	a.delete(1, 1);
	a.insert(2, "h");
	a.delete(1, 1);
	c.delete(1, 1);
	a.insert(1, "p");
	b.delete(1, 1);
	a.delete(1, 1);
	c.merge(b);
	b.merge(c);
	c.delete(1, 1);
	c.insert(3, "c");
	a.delete(0, 1);
	b.merge(c);
	c.merge(b);
	a.insert(1, "g");
	c.insert(2, "n");
	b.insert(3, "g");
	b.insert(0, "n");
	a.delete(0, 1);
	c.insert(4, "l");
	c.insert(1, "x");
	a.delete(0, 1);
	b.insert(5, "f");
	b.merge(c);
	c.merge(b);
	a.insert(0, "i");
	a.delete(0, 1);
	a.insert(0, "l");
	a.merge(c);
	c.merge(a);
	a.insert(5, "p");
	c.delete(0, 1);
	a.insert(10, "q");
	a.merge(b);
	b.merge(a);
	c.delete(0, 1);
	b.insert(8, "q");
	c.insert(1, "d");
	a.insert(11, "p");
	b.delete(8, 1);
	b.insert(10, "e");
	c.insert(1, "y");
	b.delete(9, 2);
	c.delete(0, 1);
	c.delete(3, 1);
	c.insert(0, "e");
	a.insert(3, "e");
	b.merge(c);
	c.merge(b);
	c.insert(10, "s");
	a.insert(8, "u");
	a.insert(10, "c");

	expect(toOplogRows(a)).toEqual([
		[0, "q", "a", 0, []],
		[1, "e", "b", 0, [0]],
		[2, "t", "b", 1, [1]],
		[0, 1, "a", 1, [2]],
		[0, 1, "a", 2, [3]],
		[2, "i", "b", 2, [2]],
		[2, "i", "a", 3, [4, 5]],
		[1, "b", "b", 3, [4, 5]],
		[3, 1, "a", 4, [6, 7]],
		[1, 1, "a", 5, [8]],
		[2, "h", "a", 6, [9]],
		[1, 1, "a", 7, [10]],
		[1, "p", "a", 8, [11]],
		[1, 1, "a", 9, [12]],
		[0, 1, "a", 10, [13]],
		[1, "g", "a", 11, [14]],
		[0, 1, "a", 12, [15]],
		[0, 1, "a", 13, [16]],
		[0, "i", "a", 14, [17]],
		[0, 1, "a", 15, [18]],
		[0, "l", "a", 16, [19]],
		[0, "p", "c", 0, []],
		[0, "n", "c", 1, [21]],
		[0, "d", "c", 2, [22]],
		[3, "r", "c", 3, [23]],
		[0, 1, "c", 4, [24]],
		[0, 1, "c", 5, [25]],
		[1, 1, "c", 6, [26]],
		[0, "k", "b", 4, [6, 7]],
		[1, 1, "b", 5, [28]],
		[1, 1, "c", 7, [27, 29]],
		[3, "c", "c", 8, [30]],
		[2, "n", "c", 9, [31]],
		[4, "l", "c", 10, [32]],
		[1, "x", "c", 11, [33]],
		[3, "g", "b", 6, [31]],
		[0, "n", "b", 7, [35]],
		[5, "f", "b", 8, [36]],
		[5, "p", "a", 17, [20, 34, 37]],
		[10, "q", "a", 18, [38]],
		[11, "p", "a", 19, [39]],
		[3, "e", "a", 20, [40]],
		[8, "u", "a", 21, [41]],
		[10, "c", "a", 22, [42]],
	]);
	expect(toOplogRows(b)).toEqual([
		[0, "q", "a", 0, []],
		[1, "e", "b", 0, [0]],
		[2, "t", "b", 1, [1]],
		[2, "i", "b", 2, [2]],
		[0, 1, "a", 1, [2]],
		[0, 1, "a", 2, [4]],
		[1, "b", "b", 3, [3, 5]],
		[2, "i", "a", 3, [3, 5]],
		[0, "k", "b", 4, [6, 7]],
		[1, 1, "b", 5, [8]],
		[0, "p", "c", 0, []],
		[0, "n", "c", 1, [10]],
		[0, "d", "c", 2, [11]],
		[3, "r", "c", 3, [12]],
		[0, 1, "c", 4, [13]],
		[0, 1, "c", 5, [14]],
		[1, 1, "c", 6, [15]],
		[1, 1, "c", 7, [9, 16]],
		[3, "c", "c", 8, [17]],
		[3, "g", "b", 6, [18]],
		[0, "n", "b", 7, [19]],
		[5, "f", "b", 8, [20]],
		[2, "n", "c", 9, [18]],
		[4, "l", "c", 10, [22]],
		[1, "x", "c", 11, [23]],
		[3, 1, "a", 4, [6, 7]],
		[1, 1, "a", 5, [25]],
		[2, "h", "a", 6, [26]],
		[1, 1, "a", 7, [27]],
		[1, "p", "a", 8, [28]],
		[1, 1, "a", 9, [29]],
		[0, 1, "a", 10, [30]],
		[1, "g", "a", 11, [31]],
		[0, 1, "a", 12, [32]],
		[0, 1, "a", 13, [33]],
		[0, "i", "a", 14, [34]],
		[0, 1, "a", 15, [35]],
		[0, "l", "a", 16, [36]],
		[5, "p", "a", 17, [21, 24, 37]],
		[10, "q", "a", 18, [38]],
		[8, "q", "b", 9, [39]],
		[8, 1, "b", 10, [40]],
		[10, "e", "b", 11, [41]],
		[9, 1, "b", 12, [42]],
		[9, 1, "b", 13, [43]],
		[0, 1, "c", 12, [21, 24, 37]],
		[0, 1, "c", 13, [45]],
		[1, "d", "c", 14, [46]],
		[1, "y", "c", 15, [47]],
		[0, 1, "c", 16, [48]],
		[3, 1, "c", 17, [49]],
		[0, "e", "c", 18, [50]],
	]);

	expect(a.oplog.frontier).toEqual([43]);
	expect(b.oplog.frontier).toEqual([44,51]);
	a.merge(b);
	console.dir(a.oplog.diff(b.oplog.stateVector()), { depth: null })
	b.merge(a); // [ 44, 51, 55 ], [ 44, 51, 52, 53, 55 ]
});

test("convergence with fuzzer", () => {
	for (let i = 30; i < 100; i++) {
		fuzzer(i);
	}
});

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

	// For adding a test case.
	const toLogSeed = -1;
	const toLogI = -1;

	for (let i = 0; i < 100; i++) {
		for (let d = 0; d < 3; d++) {
			// 1. Pick a random document
			const doc = randDoc();
			const len = doc.branch.snapshot.length;
			const insertWeight = len < 100 ? 0.65 : 0.35;

			// 2. Make a random change to that document
			if (len === 0 || randBool(insertWeight)) {
				const content = randChar();
				const pos = randInt(len + 1);
				doc.insert(pos, content);
				if (seed === toLogSeed && i <= toLogI)
					console.log(`${doc.site}.insert(${pos}, "${content}")`);
			} else {
				const pos = randInt(len);
				const delLen = Math.max(1, randInt(Math.min(len - pos, 3)));
				doc.delete(pos, delLen);
				if (seed === toLogSeed && i <= toLogI)
					console.log(`${doc.site}.delete(${pos}, ${delLen})`);
			}

			// doc.check()
		}

		// 3. merge 2 random docs
		const a = randDoc();
		const b = randDoc();

		if (a === b) continue;

		if (seed === toLogSeed && i <= toLogI) {
			console.log(`${a.site}.merge(${b.site})`);
			console.log(`${b.site}.merge(${a.site})`);
		}
		a.merge(b);
		b.merge(a);

		// 4. expect them to be the same
		try {
			expect(a.branch.snapshot.join("")).toBe(b.branch.snapshot.join(""));
		} catch (e) {
			console.log(
				"bad",
				seed,
				i,
				a.branch.snapshot.join(""),
				b.branch.snapshot.join(""),
			);
			throw e;
		}
	}
}

type Row = [
	pos: number,
	deleted: boolean,
	item: string,
	site: string,
	clock: number,
	parents: number[],
];
function toOplogRows(text: Text): Row[] {
	const res: Row[] = [];

	const oplog = text.oplog;
	for (let i = 0; i < oplog.length; i++) {
		res.push([
			oplog.getPos(i),
			oplog.getDeleted(i),
			oplog.getItem(i) ?? "",
			oplog.getSite(i),
			oplog.getClock(i),
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
		[0, false, "h", "a", 0, []],
		[1, false, "e", "a", 1, [0]],
		[2, false, "l", "a", 2, [1]],
		[3, false, "l", "a", 3, [2]],
		[4, false, "o", "a", 4, [3]],
		[0, false, "w", "b", 0, []],
		[1, false, "o", "b", 1, [5]],
		[2, false, "r", "b", 2, [6]],
		[3, false, "l", "b", 3, [7]],
		[4, false, "d", "b", 4, [8]],
	]);
	expect(a.oplog.frontier).toEqual(expectedFrontier);

	expect(toOplogRows(b)).toEqual([
		[0, false, "w", "b", 0, []],
		[1, false, "o", "b", 1, [0]],
		[2, false, "r", "b", 2, [1]],
		[3, false, "l", "b", 3, [2]],
		[4, false, "d", "b", 4, [3]],
		[0, false, "h", "a", 0, []],
		[1, false, "e", "a", 1, [5]],
		[2, false, "l", "a", 2, [6]],
		[3, false, "l", "a", 3, [7]],
		[4, false, "o", "a", 4, [8]],
	]);
	expect(b.oplog.frontier).toEqual(expectedFrontier);

	let expected = "helloworld";
	expect(a.toString()).toBe(expected);
	expect(b.toString()).toBe(expected);

	a.delete("hellowor".length); // delete "l"
	b.delete(0, "hello".length);
	b.insert(0, "share");

	expect(toOplogRows(a).slice(10)).toEqual([[8, true, "", "a", 5, [4, 9]]]);
	expect(toOplogRows(b).slice(10)).toEqual([
		[0, true, "", "b", 5, [4, 9]],
		[0, true, "", "b", 6, [10]],
		[0, true, "", "b", 7, [11]],
		[0, true, "", "b", 8, [12]],
		[0, true, "", "b", 9, [13]],
		[0, false, "s", "b", 10, [14]],
		[1, false, "h", "b", 11, [15]],
		[2, false, "a", "b", 12, [16]],
		[3, false, "r", "b", 13, [17]],
		[4, false, "e", "b", 14, [18]],
	]);

	a.merge(b);
	b.merge(a);

	expect(toOplogRows(a).slice(10)).toEqual([
		[8, true, "", "a", 5, [4, 9]],
		[0, true, "", "b", 5, [4, 9]],
		[0, true, "", "b", 6, [11]],
		[0, true, "", "b", 7, [12]],
		[0, true, "", "b", 8, [13]],
		[0, true, "", "b", 9, [14]],
		[0, false, "s", "b", 10, [15]],
		[1, false, "h", "b", 11, [16]],
		[2, false, "a", "b", 12, [17]],
		[3, false, "r", "b", 13, [18]],
		[4, false, "e", "b", 14, [19]],
	]);
	expect(toOplogRows(b).slice(10)).toEqual([
		[0, true, "", "b", 5, [4, 9]],
		[0, true, "", "b", 6, [10]],
		[0, true, "", "b", 7, [11]],
		[0, true, "", "b", 8, [12]],
		[0, true, "", "b", 9, [13]],
		[0, false, "s", "b", 10, [14]],
		[1, false, "h", "b", 11, [15]],
		[2, false, "a", "b", 12, [16]],
		[3, false, "r", "b", 13, [17]],
		[4, false, "e", "b", 14, [18]],
		[8, true, "", "a", 5, [4, 9]],
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
	b.merge(a);

	expect(toOplogRows(a)).toEqual([
		[0, false, "v", "b", 0, []],
		[1, false, "c", "b", 1, [0]],
	]);
	expect(toOplogRows(b)).toEqual(toOplogRows(a));
	expect(a.oplog.frontier).toEqual([1]);
	expect(b.oplog.frontier).toEqual([1]);

	a.insert(2, "e");
	b.insert(2, "z");
	b.delete(1, 1);

	expect(toOplogRows(a)).toEqual([
		[0, false, "v", "b", 0, []],
		[1, false, "c", "b", 1, [0]],
		[2, false, "e", "a", 0, [1]],
	]);
	expect(toOplogRows(b)).toEqual([
		[0, false, "v", "b", 0, []],
		[1, false, "c", "b", 1, [0]],
		[2, false, "z", "b", 2, [1]],
		[1, true, "", "b", 3, [2]],
	]);
	expect(a.oplog.frontier).toEqual([2]);
	expect(b.oplog.frontier).toEqual([3]);
	b.merge(a);
	a.merge(b);

	expect(toOplogRows(a)).toEqual([
		[0, false, "v", "b", 0, []],
		[1, false, "c", "b", 1, [0]],
		[2, false, "e", "a", 0, [1]],
		[2, false, "z", "b", 2, [1]],
		[1, true, "", "b", 3, [3]],
	]);
	expect(toOplogRows(b)).toEqual([
		[0, false, "v", "b", 0, []],
		[1, false, "c", "b", 1, [0]],
		[2, false, "z", "b", 2, [1]],
		[1, true, "", "b", 3, [2]],
		[2, false, "e", "a", 0, [1]],
	]);
	expect(a.oplog.frontier).toEqual([2, 4]);
	expect(b.oplog.frontier).toEqual([3, 4]);

	expect(a.branch.snapshot.join("")).toEqual("vez");
	expect(b.branch.snapshot.join("")).toEqual(a.branch.snapshot.join(""));
});

test("more partial op merges", () => {
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
		[0, false, "c", "b", 0, []],
		[1, false, "r", "b", 1, [0]],
		[0, false, "o", "b", 2, [1]],
		[3, false, "m", "a", 0, [2]],
		[2, true, "", "a", 1, [3]],
		[3, false, "w", "a", 2, [4]],
		[3, true, "", "a", 3, [5]],
		[0, false, "d", "a", 4, [6]],
		[1, false, "f", "a", 5, [7]],
		[0, true, "", "a", 6, [8]],
		[0, false, "g", "b", 3, [2]],
		[1, false, "t", "b", 4, [10]],
		[2, true, "", "a", 7, [9, 11]],
		[0, false, "b", "c", 0, [2]],
	]);
	expect(toOplogRows(c)).toEqual([
		[0, false, "c", "b", 0, []],
		[1, false, "r", "b", 1, [0]],
		[0, false, "o", "b", 2, [1]],
		[0, false, "b", "c", 0, [2]],
		[3, false, "m", "a", 0, [2]],
		[2, true, "", "a", 1, [4]],
		[3, false, "w", "a", 2, [5]],
		[3, true, "", "a", 3, [6]],
		[0, false, "d", "a", 4, [7]],
		[1, false, "f", "a", 5, [8]],
		[0, true, "", "a", 6, [9]],
		[0, false, "g", "b", 3, [2]],
		[1, false, "t", "b", 4, [11]],
		[2, true, "", "a", 7, [10, 12]],
	]);

	a.delete(2, 2);
	a.merge(c);
	c.merge(a);
	expect(a.oplog.frontier).toEqual([15]);
	expect(c.oplog.frontier).toEqual([15]);
	expect(toOplogRows(a)).toEqual([
		[0, false, "c", "b", 0, []],
		[1, false, "r", "b", 1, [0]],
		[0, false, "o", "b", 2, [1]],
		[3, false, "m", "a", 0, [2]],
		[2, true, "", "a", 1, [3]],
		[3, false, "w", "a", 2, [4]],
		[3, true, "", "a", 3, [5]],
		[0, false, "d", "a", 4, [6]],
		[1, false, "f", "a", 5, [7]],
		[0, true, "", "a", 6, [8]],
		[0, false, "g", "b", 3, [2]],
		[1, false, "t", "b", 4, [10]],
		[2, true, "", "a", 7, [9, 11]],
		[0, false, "b", "c", 0, [2]],
		[2, true, "", "a", 8, [12, 13]],
		[2, true, "", "a", 9, [14]],
	]);
	expect(toOplogRows(c)).toEqual([
		[0, false, "c", "b", 0, []],
		[1, false, "r", "b", 1, [0]],
		[0, false, "o", "b", 2, [1]],
		[0, false, "b", "c", 0, [2]],
		[3, false, "m", "a", 0, [2]],
		[2, true, "", "a", 1, [4]],
		[3, false, "w", "a", 2, [5]],
		[3, true, "", "a", 3, [6]],
		[0, false, "d", "a", 4, [7]],
		[1, false, "f", "a", 5, [8]],
		[0, true, "", "a", 6, [9]],
		[0, false, "g", "b", 3, [2]],
		[1, false, "t", "b", 4, [11]],
		[2, true, "", "a", 7, [10, 12]],
		[2, true, "", "a", 8, [3, 13]],
		[2, true, "", "a", 9, [14]],
	]);

	expect(a.branch.snapshot.join("")).toEqual(c.branch.snapshot.join(""));
});

test("convergence with fuzzer", () => {
	for (let i = 0; i < 100; i++) fuzzer(i);
});

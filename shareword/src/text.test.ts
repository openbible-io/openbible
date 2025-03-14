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
			} else {
				const pos = randInt(len);
				const delLen = Math.max(1, randInt(Math.min(len - pos, 3)));
				doc.delete(pos, delLen);
			}

			// doc.check()
		}

		// 3. merge 2 random docs them
		const a = randDoc();
		const b = randDoc();

		if (a === b) continue;

		a.merge(b);
		b.merge(a);

		//if (seed === 9 && i < 2) {
		//	debugPrint(a.oplog, true);
		//	debugPrint(b.oplog, true);
		//}

		// 4. expect them to be the same
		try {
			expect(a.branch.snapshot.join("")).toBe(b.branch.snapshot.join(""));
		} catch (e) {
			console.log("bad", seed, i, a.branch.snapshot, b.branch.snapshot);
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
	for (let i = 0; i < oplog.ops.length; i++) {
		const id = oplog.getId(i);
		res.push([
			oplog.getPos(i),
			oplog.getDeleted(i),
			oplog.getContent(i) ?? oplog.emptyElement,
			id.site,
			id.clock,
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

	const expectedStateVector = {
		[a.site]: aInsert.length - 1,
		[b.site]: bInsert.length - 1,
	};
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
	expect(a.oplog.stateVector.clocks).toEqual(expectedStateVector);

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
	expect(b.oplog.stateVector.clocks).toEqual(expectedStateVector);

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
	// TODO: simplify
	const a = new Text("a");
	const b = new Text("b");
	const c = new Text("c");

	a.insert(0, "w");
	a.delete(0, 1);
	c.insert(0, "s");
	c.merge(b);
	b.merge(c);

	a.insert(0, "y");
	c.insert(1, "j");
	c.delete(0, 1);
	a.merge(c);
	c.merge(a);

	expect(toOplogRows(a)).toEqual([
		[0, false, "w", "a", 0, []],
		[0, true, "", "a", 1, [0]],
		[0, false, "y", "a", 2, [1]],
		[0, false, "s", "c", 0, []],
		[1, false, "j", "c", 1, [3]],
		[0, true, "", "c", 2, [4]],
	]);
	expect(toOplogRows(c)).toEqual([
		[0, false, "s", "c", 0, []],
		[1, false, "j", "c", 1, [0]],
		[0, true, "", "c", 2, [1]],
		[0, false, "w", "a", 0, []],
		[0, true, "", "a", 1, [3]],
		[0, false, "y", "a", 2, [4]],
	]);

	b.insert(0, "w");
	b.insert(2, "b");

	a.merge(b);
	b.merge(a);

	expect(toOplogRows(a)).toEqual([
		[0, false, "w", "a", 0, []],
		[0, true, "", "a", 1, [0]],
		[0, false, "y", "a", 2, [1]],
		[0, false, "s", "c", 0, []],
		[1, false, "j", "c", 1, [3]],
		[0, true, "", "c", 2, [4]],
		[0, false, "w", "b", 0, [3]],
		[2, false, "b", "b", 1, [6]],
	]);
	expect(toOplogRows(b)).toEqual([
		[0, false, "s", "c", 0, []],
		[0, false, "w", "b", 0, [0]],
		[2, false, "b", "b", 1, [1]],
		[0, false, "w", "a", 0, []],
		[0, true, "", "a", 1, [3]],
		[0, false, "y", "a", 2, [4]],
		[1, false, "j", "c", 1, [0]],
		[0, true, "", "c", 2, [6]],
	]);

	expect(a.branch.snapshot.join("")).toEqual("ywbj");
	expect(a.branch.snapshot.join("")).toEqual(b.branch.snapshot.join(""));
});

test("convergence with fuzzer", () => {
	for (let i = 0; i < 100; i++) fuzzer(i);
});

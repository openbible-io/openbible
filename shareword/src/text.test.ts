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

	const randDoc = () => docs[randInt(3)];

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
				const delLen = randInt(Math.min(len - pos, 3));
				doc.delete(pos, delLen);
			}

			// doc.check()
		}

		// pick 2 documents and merge them
		const a = randDoc();
		const b = randDoc();

		if (a === b) continue;

		a.merge(b);
		b.merge(a);
		expect(a.branch.snapshot).toEqual(b.branch.snapshot);
	}
}

test("correctness", () => {
	const d1 = new Text("a");
	const d2 = new Text("b");

	d1.insert(0, "hello");
	d2.insert(0, "world");
	d1.merge(d2);
	d2.merge(d1);

	// expected d1:
	//┌───┬─────┬──────────┬─────────┬──────┬───────┬─────────┐
	//│   │ pos │ delCount │ content │ site │ clock │ parents │
	//├───┼─────┼──────────┼─────────┼──────┼───────┼─────────┤
	//│ 0 │ 0   │ 0        │ h       │ a    │ 0     │ []      │
	//│ 1 │ 1   │ 0        │ e       │ a    │ 1     │ [ 0 ]   │
	//│ 2 │ 2   │ 0        │ l       │ a    │ 2     │ [ 1 ]   │
	//│ 3 │ 3   │ 0        │ l       │ a    │ 3     │ [ 2 ]   │
	//│ 4 │ 4   │ 0        │ o       │ a    │ 4     │ [ 3 ]   │
	//│ 5 │ 0   │ 0        │ w       │ b    │ 0     │ []      │
	//│ 6 │ 1   │ 0        │ o       │ b    │ 1     │ [ 5 ]   │
	//│ 7 │ 2   │ 0        │ r       │ b    │ 2     │ [ 6 ]   │
	//│ 8 │ 3   │ 0        │ l       │ b    │ 3     │ [ 7 ]   │
	//│ 9 │ 4   │ 0        │ d       │ b    │ 4     │ [ 8 ]   │
	//└───┴─────┴──────────┴─────────┴──────┴───────┴─────────┘
	//debugPrint(d1.oplog);
	//debugPrint(d2.oplog);
	expect(d1.oplog.frontier).toEqual([4, 9]);
	expect(d1.oplog.stateVector).toEqual({ [d1.site]: 4, [d2.site]: 4 });
	expect(d1.oplog.getParents(5)).toEqual([]);
	expect(d1.oplog.getParents(9)).toEqual([8]);

	let expected = "helloworld";
	expect(d1.toString()).toBe(expected);
	expect(d2.toString()).toBe(expected);

	d1.delete("hellowor".length); // delete "l"
	d2.delete(0, "hello".length);
	d2.insert(0, "share");

	d1.merge(d2);
	d2.merge(d1);
	// expected d1:
	//┌────┬─────┬──────────┬─────────┬──────┬───────┬──────────┐
	//│    │ pos │ delCount │ content │ site │ clock │ parents  │
	//├────┼─────┼──────────┼─────────┼──────┼───────┼──────────┤
	//│  0 │ 0   │ 0        │ h       │ a    │ 0     │ []       │
	//│  1 │ 1   │ 0        │ e       │ a    │ 1     │ [ 0 ]    │
	//│  2 │ 2   │ 0        │ l       │ a    │ 2     │ [ 1 ]    │
	//│  3 │ 3   │ 0        │ l       │ a    │ 3     │ [ 2 ]    │
	//│  4 │ 4   │ 0        │ o       │ a    │ 4     │ [ 3 ]    │
	//│  5 │ 0   │ 0        │ w       │ b    │ 0     │ []       │
	//│  6 │ 1   │ 0        │ o       │ b    │ 1     │ [ 5 ]    │
	//│  7 │ 2   │ 0        │ r       │ b    │ 2     │ [ 6 ]    │
	//│  8 │ 3   │ 0        │ l       │ b    │ 3     │ [ 7 ]    │
	//│  9 │ 4   │ 0        │ d       │ b    │ 4     │ [ 8 ]    │
	//│ 10 │ 8   │ 1        │         │ a    │ 5     │ [ 4, 9 ] │
	//│ 11 │ 0   │ 1        │         │ b    │ 5     │ [ 4, 9 ] │
	//│ 12 │ 0   │ 1        │         │ b    │ 6     │ [ 11 ]   │
	//│ 13 │ 0   │ 1        │         │ b    │ 7     │ [ 12 ]   │
	//│ 14 │ 0   │ 1        │         │ b    │ 8     │ [ 13 ]   │
	//│ 15 │ 0   │ 1        │         │ b    │ 9     │ [ 14 ]   │
	//│ 16 │ 0   │ 0        │ s       │ b    │ 10    │ [ 15 ]   │
	//│ 17 │ 1   │ 0        │ h       │ b    │ 11    │ [ 16 ]   │
	//│ 18 │ 2   │ 0        │ a       │ b    │ 12    │ [ 17 ]   │
	//│ 19 │ 3   │ 0        │ r       │ b    │ 13    │ [ 18 ]   │
	//│ 20 │ 4   │ 0        │ e       │ b    │ 14    │ [ 19 ]   │
	//└────┴─────┴──────────┴─────────┴──────┴───────┴──────────┘
	debugPrint(d1.oplog, true);
	debugPrint(d1.oplog);
	//debugPrint(d2.oplog);

	expected = "shareword";
	expect(d1.toString()).toBe(expected);
	expect(d2.toString()).toBe(expected);
});

test("convergence with fuzzer", () => {
	for (let i = 0; i < 100; i++) {
		console.log(i);
		fuzzer(i);
	}
});

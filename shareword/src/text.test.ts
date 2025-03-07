import { test, expect } from "bun:test";
import { Text } from "./text";
import { mulberry32 } from "../bench/harness";

function fuzzer(seed: number) {
	const random = mulberry32(seed);

	const randInt = (n: number) => Math.floor(random() * n);
	const randBool = (weight = 0.5) => random() < weight;

	const alphabet = " abcdefghijklmnopqrstuvwxyz";
	const randChar = () => alphabet[randInt(alphabet.length)];

	const docs = [
		new Text("a"),
		new Text("b"),
		new Text("c"),
	];

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

	let expected = "helloworld"
	expect(d1.toString()).toBe(expected);
	expect(d2.toString()).toBe(expected);

	d1.delete("hellowor".length);
	d2.delete(0, "hello".length);
	d2.insert(0, "share");

	d1.merge(d2);
	d2.merge(d1);

	expected = "shareword"
	expect(d1.toString()).toBe(expected);
	expect(d2.toString()).toBe(expected);
});

//test("convergence with fuzzer", () => {
//	for (let i = 0; i < 100; i++) fuzzer(i);
//});

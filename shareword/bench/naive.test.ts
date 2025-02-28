import { test, expect } from "bun:test";
import { Doc } from "./naive";

function merge(d1: Doc, d2: Doc) {
	const p1 = d1.generatePatch({ ...d2.version });
	const p2 = d2.generatePatch({ ...d1.version });
	if (p1 && p2) {
		d1.applyPatch(p2, d2.version);
		d2.applyPatch(p1, d1.version);
	}
}

test("simple", () => {
	const d1 = new Doc("a");
	const d2 = new Doc("b");

	d1.insert(0, "hello");
	d2.insert(0, "world");

	merge(d1, d2);

	const expected = "helloworld"
	expect(d1.text()).toBe(expected);
	expect(d2.text()).toBe(expected);

	d2.insert(expected.length, "d");

	console.log(d2.text())
	console.dir(d2, { depth: null });
});

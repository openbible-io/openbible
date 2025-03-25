import { test, expect } from "bun:test";
import { List } from "./list";

test("correctness", () => {
	const d1 = new List<number>("a");
	const d2 = new List<number>("b");

	d1.insert(0, 10);
	d1.insert(1, 20);
	d2.insert(0, 30);
	d2.insert(1, 40);

	d1.merge(d2);
	d2.merge(d1);

	let expected = [10, 20, 30, 40];
	expect(d1.items()).toEqual(expected);
	expect(d2.items()).toEqual(expected);

	d1.delete(1, 2);
	d2.delete(2, 2);

	d1.merge(d2);
	d2.merge(d1);

	expected = [10];
	expect(d1.items()).toEqual(expected);
	expect(d2.items()).toEqual(expected);
});

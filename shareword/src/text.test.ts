import { test, expect } from "bun:test";
import Text from "./text";

test("insert, delete, walk", () => {
	const t = new Text();

	t.insert("hello");
	t.insert(" world");

	const expected = "hello world";
	expect(t.selections).toEqual([{ pos: expected.length, len: 0 }]);
	expect(t.values()).toEqual(expected);

	t.delete();
	expect(t.values()).toEqual("hello worl");
	expect(t.selections).toEqual([{ pos: expected.length - 1, len: 0 }]);
});

test("delete forwards", () => {
	const t = new Text("hello world");

	t.selections = [{ pos: 0 }];
	t.delete();
	expect(t.values()).toEqual("hello world");

	t.delete(true);
	expect(t.values()).toEqual("ello world");
});

test("multiple selections", () => {
	const t = new Text(" ");

	t.selections = [{ pos: 1 }, { pos: 0 }];
	t.insert("pizza");

	expect(t.values()).toEqual("pizza pizza");
	expect(t.selections).toEqual([
		{ pos: "pizza".length, len: 0 },
		{ pos: "pizza".length * 2 + 1, len: 0 },
	]);

	t.delete();
	expect(t.values()).toEqual("pizz pizz");
	console.log(t.list);
});

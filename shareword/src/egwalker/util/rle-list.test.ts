import { test, expect } from "bun:test";
import { RleList } from "./rle-list";

test("rle-list", () => {
	type Foo = { foo: string };
	const list = new RleList<Foo>();

	const tryAppend = (prev: Foo, cur: Foo) => {
		prev.foo += cur.foo;
		return true;
	};
	list.push({ foo: "a" }, tryAppend);
	list.push({ foo: "b" }, tryAppend);
	list.push({ foo: "c" }, tryAppend);

	expect(list.items).toEqual([{ foo: "abc" }]);
});

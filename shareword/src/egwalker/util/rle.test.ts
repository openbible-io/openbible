import { test, expect } from "bun:test";
import { Rle } from "./rle";
import { MultiArrayList } from "./multi-array-list";

type Foo = { foo: string };
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function testFoo(rle: Rle<Foo, any>) {
	rle.push({ foo: "a" });
	rle.push({ foo: "b" });
	rle.push({ foo: "c" });
	rle.push({ foo: "1" });
	rle.push({ foo: "2" });

	expect(rle.ranges.length).toBe(2);
	expect(rle.ranges.at(0)).toEqual({ start: 0, len: 3 });
	expect(rle.ranges.at(1)).toEqual({ start: 3, len: 2 });

	expect(rle.offsetOf(1)).toEqual({ idx: 0, offset: 1 });
	expect(rle.offsetOf(4)).toEqual({ idx: 1, offset: 1 });
	expect(rle.at(0)).toEqual({ foo: "abc" });
	expect(rle.at(1)).toEqual({ foo: "abc" });
	expect(rle.at(2)).toEqual({ foo: "abc" });
	expect(rle.at(3)).toEqual({ foo: "12" });
	expect(rle.at(4)).toEqual({ foo: "12" });
	expect(rle.at(5)).toBeUndefined();
}

test("rle array", () => {
	testFoo(
		new Rle<Foo, Foo[]>([], (items, cur) => {
			if (items.length === 0 || cur.foo === "1")
				return false;

			items[items.length - 1].foo += cur.foo;
			return true;
		}),
	);
});

test("rle multiarraylist", () => {
	testFoo(
		new Rle<Foo, MultiArrayList<Foo>>(
			new MultiArrayList<Foo>({ foo: "abc" }),
			(items, cur) => {
				if (items.length === 0 || cur.foo === "1") return false;

				items.fields.foo[items.length - 1] += cur.foo;
				return true;
			},
		),
	);
});

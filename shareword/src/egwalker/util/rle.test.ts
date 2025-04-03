import { test, expect } from "bun:test";
import { Rle } from "./rle";
import { MultiArrayList } from "./multi-array-list";

type Foo = { foo: string };
function testFoo(rle: Rle<Foo, any>) {
	rle.push({ foo: "a" });
	rle.push({ foo: "b" });
	rle.push({ foo: "c" });
	rle.push({ foo: "1" });
	rle.push({ foo: "2" });

	expect(rle.startIdxs).toEqual([0, 3]);

	expect(rle.offsetOf(1)).toEqual({ idx: 0, offset: 1 });
	expect(rle.offsetOf(4)).toEqual({ idx: 1, offset: 1 });
	expect(rle.at(0)).toEqual({ foo: "a" });
	expect(rle.at(1)).toEqual({ foo: "b" });
	expect(rle.at(2)).toEqual({ foo: "c" });
	expect(rle.at(3)).toEqual({ foo: "1" });
	expect(rle.at(4)).toEqual({ foo: "2" });
	expect(rle.at(5)).toBeUndefined();

	const sliced = rle.slice(2, 4);
	expect(sliced.at(0)).toEqual({ foo: "c" });
	expect(sliced.at(1)).toEqual({ foo: "1" });
}

test("rle array", () =>
	testFoo(
		new Rle<Foo, Foo[]>(
			[],
			(ctx, cur) => {
				if (cur.foo === "1") return false;

				ctx.items[ctx.items.length - 1].foo += cur.foo;
				return true;
			},
			(item, start, end) => ({ foo: item.foo.slice(start, end) }),
		),
	));

test("rle multiarraylist", () =>
	testFoo(
		new Rle<Foo, MultiArrayList<Foo>>(
			new MultiArrayList<Foo>({ foo: "abc" }),
			(ctx, cur) => {
				if (cur.foo === "1") return false;

				ctx.items.fields.foo[ctx.items.length - 1] += cur.foo;
				return true;
			},
			(item, start, end) => ({ foo: item.foo.slice(start, end) }),
		),
	)
);

import { test, expect } from "bun:test";
import { Rle } from "./rle";

type Foo = { foo: string };
function testFoo(rle: Rle<Foo>) {
	rle.push({ foo: "a" });
	rle.push({ foo: "b" });
	rle.push({ foo: "c" });
	rle.push({ foo: "1" });
	rle.push({ foo: "2" });

	expect(rle.length).toBe(2);
	expect(rle.count).toBe(5);

	expect(rle.indexOf(0)).toEqual({ idx: 0, offset: 0 });
	expect(rle.indexOf(1)).toEqual({ idx: 0, offset: 1 });
	expect(rle.indexOf(4)).toEqual({ idx: 1, offset: 1 });
	expect(rle.indexOf(5)).toEqual({ idx: 1, offset: 2 });

	const slice1 = rle.slice();
	expect(slice1.items).toEqual([{ foo: "abc" }, { foo : "12" }]);
	expect(slice1.offsets).toEqual([0, 3]);
	expect(slice1.count).toEqual(5);

	const slice2 = rle.slice(4, 5);
	expect(slice2.items).toEqual([{ foo: "2" }]);
	expect(slice2.offsets).toEqual([0]);
	expect(slice2.count).toEqual(1);

	const slice3 = rle.slice(1, 4);
	expect(slice3.items).toEqual([{ foo: "bc" }, { foo: "1" }]);
	expect(slice3.offsets).toEqual([0, 2]);
	expect(slice3.count).toEqual(3);

	const slice4 = rle.slice(2, 100);
	expect(slice4.items).toEqual([{ foo: "c" }, { foo: "12" }]);
	expect(slice4.offsets).toEqual([0, 1]);
	expect(slice4.count).toEqual(3);

	const slice5 = rle.slice(3, 5);
	expect(slice5.items).toEqual([{ foo: "12" }]);
	expect(slice5.offsets).toEqual([0]);
	expect(slice5.count).toEqual(2);
}

test("simple array", () => {
	testFoo(
		new Rle<Foo>(
			(ctx, cur) => {
				if (cur.foo === "1") return false;

				ctx.items[ctx.items.length - 1].foo += cur.foo;
				return true;
			},
			(foo, start, end) => ({ foo: foo.foo.slice(start, end) }),
		),
	);
});

// Scrapped cuz it wasn't faster. Worth revisiting later.
// test("multiarraylist", () => {
// 	testFoo(
// 		new Rle<Foo, MultiArrayList<Foo>>(
// 			new MultiArrayList<Foo>({ foo: "abc" }),
// 			(ctx, cur) => {
// 				if (cur.foo === "1") return false;
//
// 				ctx.items.fields.foo[ctx.items.length - 1] += cur.foo;
// 				return true;
// 			},
// 			(foo, start, end) => ({ foo: foo.foo.slice(start, end) }),
// 		),
// 	);
// });

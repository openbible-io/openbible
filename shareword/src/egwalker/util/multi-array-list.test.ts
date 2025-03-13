import { test, expect } from "bun:test";
import { MultiArrayList } from "./multi-array-list";

test("multi array list", () => {
	const shape = { foo: "asd", bar: "ddd" };

	const arr = new MultiArrayList(shape);
	arr.push(shape);
	arr.push(shape);

	expect(arr.at(1)).toEqual(shape);
	expect(arr.fields.foo).toEqual(["asd", "asd"]);
});

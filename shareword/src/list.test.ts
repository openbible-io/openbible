import { test, expect } from "bun:test";
import List from './list';

test("insert, delete, walk", () => {
	const list = new List<number>();
	list.insert(0, 10);
	list.insert(0, 20);

	expect(list.values()).toEqual([20, 10]);

	list.delete(1, 1);
	expect(list.values()).toEqual([20]);
});

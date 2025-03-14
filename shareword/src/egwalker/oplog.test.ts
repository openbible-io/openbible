import { test, expect } from "bun:test";
import { debugPrint, OpLog } from "./oplog";

function stringOpLog() {
	return new OpLog<string, string>(
		"",
		(acc, others) => acc + others,
	);
}

function expectHel(oplog: ReturnType<typeof stringOpLog>) {
	expect(oplog.length).toBe(3);
	expect(oplog.ops.items.fields.items[0]).toBe("hel");
	expect(oplog.getId(2)).toEqual({ site: "a", clock: 2 });
	expect(oplog.getPos(2)).toBe(2);
	expect(oplog.getDeleted(2)).toBe(false);
	expect(oplog.getItem(2)).toBe("l");
	expect(oplog.getParents(0)).toEqual([]);
	expect(oplog.getParents(1)).toEqual([0]);
	expect(oplog.getParents(2)).toEqual([1]);
	expect(() => oplog.getParents(3)).toThrowError();
}

test("insert", () => {
	let oplog = stringOpLog();

	oplog.insertRle("a", 0, "h");
	oplog.insertRle("a", 1, "e");
	oplog.insertRle("a", 2, "l");

	expectHel(oplog);

	oplog = stringOpLog();
	oplog.insertRle("a", 0, "hel");

	expectHel(oplog);
});

test("delete", () => {
	let oplog = stringOpLog();

	oplog.insertRle("a", 0, "hel");
	expectHel(oplog);

	oplog.deleteRle("b", 0, 1);
	oplog.deleteRle("b", 0, 1);
	oplog.deleteRle("b", 0, 1);
	expect(oplog.getDeleted(4)).toBe(true);

	oplog = stringOpLog();
	oplog.insertRle("a", 0, "hel");
	oplog.deleteRle("b", 0, 3);
	expect(oplog.getDeleted(4)).toBe(true);
});

test("parents", () => {
	const a = stringOpLog();
	const site = "a";
	let clock = 0;

	a.push({ site, clock }, [], 0, 0, "abc");
	clock += 3;
	a.push({ site, clock }, [0,1], 0, 0, "def");

	expect(a.getParents(0)).toEqual([]);
	expect(a.getParents(1)).toEqual([0]);
	expect(a.getParents(2)).toEqual([1]);
	expect(a.getParents(3)).toEqual([0,1]);
	expect(a.getParents(4)).toEqual([3]);
	expect(a.getParents(5)).toEqual([4]);
});

test("merge", () => {
	const a = stringOpLog();
	const b = stringOpLog();

	a.insertRle("a", 0, "1");
	b.insertRle("b", 0, "23");

	a.merge(b);

	expect(a.getParents(0)).toEqual([]);
	expect(a.getParents(1)).toEqual([]);
	expect(a.getParents(2)).toEqual([1]);
});

import { test, expect } from "bun:test";
import { OpLog } from "./oplog";

function stringOpLog() {
	return new OpLog<string, string>((acc, others) => acc + others);
}

function expectHel(oplog: ReturnType<typeof stringOpLog>) {
	expect(oplog.length).toBe(3);
	expect(oplog.getSite(2)).toEqual("a");
	expect(oplog.getClock(2)).toEqual(2);
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

	oplog.insert("a", 0, "h");
	oplog.insert("a", 1, "e");
	oplog.insert("a", 2, "l");

	expectHel(oplog);

	oplog = stringOpLog();
	oplog.insert("a", 0, "hel");

	expectHel(oplog);
});

test("delete", () => {
	let oplog = stringOpLog();

	oplog.insert("a", 0, "hel");
	expectHel(oplog);

	oplog.delete("b", 0, 1);
	oplog.delete("b", 0, 1);
	oplog.delete("b", 0, 1);
	expect(oplog.getDeleted(4)).toBe(true);

	oplog = stringOpLog();
	oplog.insert("a", 0, "hel");
	oplog.delete("b", 0, 3);
	expect(oplog.getDeleted(4)).toBe(true);
});

test("parents", () => {
	const a = stringOpLog();
	const site = "a";
	let clock = 0;

	a.insertRle(site, clock, [],  0, "abc");
	clock += 3;
	a.insertRle(site, clock, [0,1],  0, "def");

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

	a.insert("a", 0, "1");
	b.insert("b", 0, "23");

	a.merge(b);

	expect(a.getParents(0)).toEqual([]);
	expect(a.getParents(1)).toEqual([]);
	expect(a.getParents(2)).toEqual([1]);
});

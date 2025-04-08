import { test, expect } from "bun:test";
import { debugPrint, debugRows, OpLog } from "./oplog";

function stringOpLog() {
	return new OpLog<string, string>((acc, others) => acc + others);
}

function expectHel(oplog: ReturnType<typeof stringOpLog>) {
	expect(debugRows(oplog)).toEqual([
		{ start: 0, id: "a0", position: 0, data: "hel", parents: [] },
	]);
	expect(() => oplog.parentsAt(3)).toThrowError();
}

test("insert", () => {
	let oplog = stringOpLog();

	oplog.insert("a", 0, "h");
	oplog.insert("a", 1, "e");
	oplog.insert("a", 2, "l");

	console.dir(oplog, { depth: null });

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
	expect(debugRows(oplog)).toEqual([
		{ start: 0, id: "a0", position: 0, data: "hel", parents: [] },
		{ start: 3, id: "b0", position: 0, data: -3, parents: [2] },
	]);

	oplog = stringOpLog();
	oplog.insert("a", 0, "hel");
	oplog.delete("b", 0, 3);
	expect(debugRows(oplog)).toEqual([
		{ start: 0, id: "a0", position: 0, data: "hel", parents: [] },
		{ start: 3, id: "b0", position: 0, data: -3, parents: [2] },
	]);
});

test("merge", () => {
	const a = stringOpLog();
	const b = stringOpLog();

	a.insert("a", 0, "1");
	b.insert("b", 0, "23");

	a.merge(b);

	expect(a.parentsAt(0)).toEqual([]);
	expect(a.parentsAt(1)).toEqual([]);
	expect(a.parentsAt(2)).toEqual([1]);
});

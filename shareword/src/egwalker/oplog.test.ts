import { test, expect } from "bun:test";
import { advanceFrontier, debugPrint, debugRows2, OpLog } from "./oplog";

function stringOpLog() {
	return new OpLog<string, string>((acc, others) => acc + others);
}

function expectHel(oplog: ReturnType<typeof stringOpLog>) {
	expect(debugRows2(oplog)).toEqual([
		[ "a0", 0, "hel", [] ],
	]);
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
	expect(debugRows2(oplog)).toEqual([
		[ "a0",  0, "hel", [] ],
		[ "b0",  0, -3, [[0, 2]] ],
	]);

	oplog = stringOpLog();
	oplog.insert("a", 0, "hel");
	oplog.delete("b", 0, 3);
	expect(debugRows2(oplog)).toEqual([
		[ "a0", 0, "hel", [] ],
		[ "b0", 0, -3, [[0, 2]] ],
	]);
});

test("advanceFrontier", () => {
	expect(advanceFrontier([], [], 4)).toEqual([4]);
	expect(advanceFrontier([4], [], 260)).toEqual([4, 260]);
	expect(advanceFrontier([4, 260], [4, 260], 512)).toEqual([512]);
	expect(advanceFrontier(
		[0, 4],
		[4, 9],
		5
	)).toEqual([
			0,
			5,
	]);
});

test("merge", () => {
	const a = stringOpLog();
	const b = stringOpLog();

	a.insert("a", 0, "1");
	b.insert("b", 0, "23");

	a.merge(b);
	debugPrint(a);

	expect(debugRows2(a)).toEqual([
		[ "a0", 0, "1", [] ],
		[ "b0", 0, "23", [] ],
	]);
});

import { test, expect } from "bun:test";
import { debugPrint, OpLog } from "./oplog";
import type { Accumulator, Clock, OpData, Site } from "./op";

function stringOpLog(site: Site = "a") {
	return new OpLog<string, string>(site);
}

type OpRow<T, AccT extends Accumulator<T>> = [
	id: string,
	data: OpData<T, AccT>,
	parents: Clock[],
];
function toRows(
	oplog: ReturnType<typeof stringOpLog>,
): OpRow<string, string>[] {
	const res: OpRow<string, string>[] = [];
	for (let i = 0; i < oplog.length; i++) {
		const op = oplog.at(i);
		res.push([`${op.site}${op.siteClock}`, op.data, op.parents]);
	}
	return res;
}

function expectHel(oplog: ReturnType<typeof stringOpLog>) {
	expect(toRows(oplog)).toEqual([
		["a0", "h", []],
		["a1", "e", [0]],
		["a2", "l", [1]],
	]);
}

test("basic insert", () => {
	let oplog = stringOpLog();

	oplog.insert("h");
	oplog.insert("e");
	oplog.insert("l");
	expectHel(oplog);

	oplog = stringOpLog();
	oplog.insert("hel");
	expectHel(oplog);
});

function expectDelete(oplog: ReturnType<typeof stringOpLog>) {
	expect(toRows(oplog)).toEqual([
		["b0", -1, []],
		["b1", -1, [0]],
		["b2", -1, [1]],
	]);
}

test("delete", () => {
	let oplog = stringOpLog("b");

	oplog.delete(1);
	oplog.delete(1);
	oplog.delete(1);
	expectDelete(oplog);

	oplog = stringOpLog("b");
	oplog.delete(3);
	expectDelete(oplog);
});

test("forwards insertion rle", () => {
	const a = stringOpLog();

	a.insert("1");
	a.insert("2");
	expect(a.lengthCompressed).toBe(1);
});

test("backwards insertion rle", () => {
	const a = stringOpLog();

	a.insert("2"); // id = a0
	a.seek(0);
	a.insert("1"); // id = a1
	expect(a.siteLogs.a?.lengthCompressed).toBe(3); // not communative
	a.site = "b"
	a.insert("asdf");
	a.site = "a"
	a.insert("fdsa");

	console.dir(a, { depth: null })
	debugPrint(a, true);
	debugPrint(a);
});

test("forwards deletion rle", () => {
	const a = stringOpLog();

	a.delete();
	a.delete();
	a.delete();
	expect(a.lengthCompressed).toBe(1);
});

test("backwards deletion rle", () => {
	const a = stringOpLog();

	a.delete(); // pos 0
	a.seek(1);
	a.delete(); // pos 1
	a.seek(2);
	a.delete(); // pos 2
	expect(a.lengthCompressed).toBe(1);
});

//test("simple merge", () => {
//	const a = stringOpLog();
//	const b = stringOpLog();
//
//	a.insert("a", 0, "1");
//	b.insert("b", 0, "23");
//
//	a.merge(b);
//
//	expect(a.getParents(0)).toEqual([]);
//	expect(a.getParents(1)).toEqual([]);
//	expect(a.getParents(2)).toEqual([1]);
//});

import { test, expect } from "bun:test";
import { OpLog } from "./oplog";

function stringOpLog() {
	return new OpLog<string, string>(
		"",
		(acc, others) => acc + others,
	);
}

function expectHel(oplog: ReturnType<typeof stringOpLog>) {
	// rle works?
	expect(oplog.length).toBe(3);
	expect(oplog.ops.items.fields.items[0]).toBe("hel");
	expect(oplog.getId(2)).toEqual({ site: "a", clock: 2 });
	expect(oplog.getPos(2)).toBe(2);
	expect(oplog.getDeleteCount(2)).toBe(0);
	expect(oplog.getContent(2)).toBe("l");
	expect(oplog.getParents(2)).toEqual([1]);
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
	const oplog = stringOpLog();

	oplog.delete("b", 0, 1);
	oplog.delete("b", 0, 1);
	oplog.delete("b", 0, 1);

	// rle works?
	expect(oplog.getDeleteCount(0)).toBe(3);
});

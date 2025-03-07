import { test, expect } from "bun:test";
import { tryAppendOp, type Op } from "./oplog";

test("insert", () => {
	const op1: Op<string> = {
		pos: 0,
		delCount: 0,
		content: "h",
		id: { site: "a", clock: 0 },
		parents: [],
	};

	const op2: Op<string> = {
		pos: 1,
		delCount: 0,
		content: "e",
		id: { site: "a", clock: 1 },
		parents: [0],
	};

	const op3: Op<string> = {
		pos: 2,
		delCount: 0,
		content: "l",
		id: { site: "a", clock: 2 },
		parents: [1],
	};

	expect(tryAppendOp(op1, op2)).toBe(true);
	expect(op1.content).toBe("he");

	expect(tryAppendOp(op1, op3)).toBe(true);
	expect(op1.content).toBe("hel");
});

test("insert2", () => {
	const op1: Op<string> = {
		pos: 0,
		delCount: 0,
		content: "s",
		id: {
			site: "b",
			clock: 10,
		},
		parents: [10],
	};
	const op2: Op<string> = {
		pos: 1,
		delCount: 0,
		content: "h",
		id: {
			site: "b",
			clock: 11,
		},
		parents: [11],
	};
	const op3: Op<string> = {
		pos: 2,
		delCount: 0,
		content: "a",
		id: {
			site: "b",
			clock: 12,
		},
		parents: [12],
	};

	expect(tryAppendOp(op1, op2)).toBe(true);
	expect(op1.content).toBe("sh");

	expect(tryAppendOp(op1, op3)).toBe(true);
	expect(op1.content).toBe("sha");
});

test("delete", () => {
	const op1: Op<string> = {
		pos: 0,
		delCount: 1,
		content: "",
		id: { site: "b", clock: 5 },
		parents: [4],
	};

	const op2: Op<string> = {
		pos: 0,
		delCount: 1,
		content: "",
		id: { site: "b", clock: 6 },
		parents: [5],
	};

	const op3: Op<string> = {
		pos: 0,
		delCount: 1,
		content: "",
		id: { site: "b", clock: 7 },
		parents: [6],
	};

	expect(tryAppendOp(op1, op2)).toBe(true);
	expect(op1.delCount).toBe(2);

	expect(tryAppendOp(op1, op3)).toBe(true);
	expect(op1.delCount).toBe(3);
});

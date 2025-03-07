import { test, expect } from "bun:test";
import { tryAppendOp, type Op } from "./oplog";

//test("tryAppendOp", () => {
//	const op1: Op<string> = {
//		pos: 0,
//		delCount: 0,
//		content: 'h',
//		id: { site: 'a', clock: 0 },
//		parents: [],
//	};
//
//	const op2: Op<string> = {
//		pos: 1,
//		delCount: 0,
//		content: 'e',
//
//		id: { site: 'a', clock: 1 },
//		parents: [0],
//	};
//
//	const op3: Op<string> = {
//		pos: 2,
//		delCount: 0,
//		content: 'l',
//
//		id: { site: 'a', clock: 2 },
//		parents: [1],
//	};
//
//	expect(tryAppendOp(op1, op2)).toBe(true);
//	expect(op1.content).toBe('he');
//
//	expect(tryAppendOp(op1, op3)).toBe(true);
//	expect(op1.content).toBe('hel');
//});

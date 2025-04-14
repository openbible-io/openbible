import { test, expect } from "bun:test";
import { decodeDiff, findHead, type DiffResult } from "./branch";
import { refEncode, refDecode } from "./op";
import { OpLog } from "./oplog";


test("partial op merge diff", () => {
	//          ┌─────────┐
	//          │ 0       │
	//          │ b0      │
	//          │ 0, abcd │
	//          └─────────┘
	//          ▲         ▲
	//          │       1 │
	// ┌────────┐         ┌────────┐
	// │ 1      │         │ 2      │
	// │ b3     │         │ a0     │
	// │ 1, -1  │         │ 2, C   │
	// └────────┘         └────────┘
	const log = new OpLog<string, string>((acc, cur) => acc + cur);
	log.push("b", 0, "abcd");
	log.push("b", 1, -1);
	log.push("a", 2, "e", 0, [refEncode(0, 1)]);

	expect(
		decodeDiff(
			findHead(
				(r) => log.parentsAt(r),
				[refEncode(1, 0)],
				[refEncode(1, 0), refEncode(2, 0)],
			),
		),
	).toEqual({
		head: [[0, 1]],
		shared: {
			start: [0, 2],
			end: [1, 0],
		},
		destOnly: {
			start: [2, 0],
			end: [2, 0],
		},
	});
});

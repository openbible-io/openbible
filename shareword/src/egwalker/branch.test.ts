import { test, expect } from "bun:test";
import { diff } from "./branch";
import { refEncode as opEncode } from "./op";
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
	log.push("a", 2, "e", 0, [opEncode(0, 1)]);

	expect(
		diff(
			(r) => log.parentsAt(r),
			[opEncode(1, 0)],
			[opEncode(1, 0), opEncode(2, 0)],
		),
	).toEqual({
		head: [opEncode(0, 1)],
		shared: [opEncode(0, 2), opEncode(0, 3), opEncode(1, 0)],
		destOnly: [opEncode(2, 0)],
	});
});

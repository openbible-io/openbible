import { test, expect } from "bun:test";
import { BTree, Node } from "./btree";
import { refEncode } from "../op";
import { type Item, State } from "../crdt-list";

test("correctness", () => {
	const bt = new BTree<string>(
		(value, start, end) => value.slice(start, end),
		32,
	);

	const value = "0123456789";
	bt.insert(0, value, value.length);
	expect(bt.length).toBe(value.length);

	bt.insert(3, "", -1);
	expect(bt.root).toEqual(new Node<string>([3, -1, 7], ["012", "", "3456789"]));
	expect(bt.length).toBe(9);

	bt.insert(0, "-", 1);
	expect(bt.root).toEqual(
		new Node<string>([1, 3, -1, 7], ["-", "012", "", "3456789"]),
	);
	expect(bt.length).toBe(10);

	bt.insert(1, "+", 1);
	expect(bt.root).toEqual(
		new Node<string>([1, 1, 3, -1, 7], ["-", "+", "012", "", "3456789"]),
	);
	expect(bt.length).toBe(11);

	bt.insert(11, "=", 1);
	expect(bt.root).toEqual(
		new Node<string>(
			[1, 1, 3, -1, 7, 1],
			["-", "+", "012", "", "3456789", "="],
		),
	);
	expect(bt.length).toBe(12);
});

test("crdt items", () => {
	const bt = new BTree<Item>((item, start) => ({
		ref: item.ref + start,
		originLeft: item.originLeft + start,
		originRight: item.originRight,
		deleted: item.deleted,
		state: item.state,
	}));
	bt.insert(
		0,
		{
			ref: refEncode(0, 0),
			originLeft: -1,
			originRight: -1,
			deleted: false,
			state: State.Inserted,
		},
		100,
	);
	// biome-ignore lint/style/noNonNullAssertion: check on next line
	const p49 = bt.get(49)!;
	expect(p49).toEqual({
		ref: refEncode(0, 49),
		originLeft: refEncode(0, 48),
		originRight: -1,
		deleted: false,
		state: State.Inserted,
	});
	bt.insert(
		50,
		{
			ref: refEncode(1, 0),
			originLeft: p49.ref,
			originRight: -1,
			deleted: true,
			state: State.Deleted,
		},
		-10,
	);
	expect(bt.root).toEqual(
		new Node<Item>(
			[50, -10, 50],
			[
				{
					ref: refEncode(0, 0),
					originLeft: -1,
					originRight: -1,
					deleted: false,
					state: State.Inserted,
				},
				{
					ref: refEncode(1, 0),
					originLeft: refEncode(0, 49),
					originRight: -1,
					deleted: true,
					state: State.Deleted,
				},
				{
					ref: refEncode(0, 50),
					originLeft: refEncode(0, 49),
					originRight: -1,
					deleted: false,
					state: State.Inserted,
				},
			],
		),
	);
});

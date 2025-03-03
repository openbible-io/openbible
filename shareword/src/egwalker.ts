import type { Clock, OpLog } from "./oplog";

export enum State {
	NotInserted = -1,
	Inserted = 0,
	Deleted = 1,
	// DeletedTwice = 2,
	// DeletedThrice = 3,
	// ...
}

export type Item = {
	clock: Clock;
	originLeft: Clock | -1;
	originRight: Clock | -1;
	deleted: boolean;
	state: State;
};

export class EgWalker {
	items: Item[] = [];
	currentVersion: Clock[] = [];

	delTargets: Clock[] = []; // LV of a delete op
	itemsByLV: Item[] = []; // Map from LV => CRDTItem.
	// itemsByLV: Map<LV, CRDTItem> // Map from LV => CRDTItem.

	retreat<T>(oplog: OpLog<T>, opLv: Clock) {
		const op = oplog.ops[opLv];

		const targetLV = op.type === "ins" ? opLv : this.delTargets[opLv];

		const item = this.itemsByLV[targetLV];
		item.state--;
	}

	advance<T>(oplog: OpLog<T>, opLv: Clock) {
		const op = oplog.ops[opLv];

		const targetLV = op.type === "ins" ? opLv : this.delTargets[opLv];

		const item = this.itemsByLV[targetLV];
		item.state++;
	}

	apply<T>(oplog: OpLog<T>, snapshot: T[] | null, opLv: Clock) {
		const op = oplog.ops[opLv];

		if (op.type === "del") {
			// Delete!

			// find the item that will be deleted.
			let { idx, endPos } = findByCurrentPos(this.items, op.pos);

			// Scan forward to find the actual item!
			while (this.items[idx].state !== State.Inserted) {
				if (!this.items[idx].deleted) endPos++;
				idx++;
			}

			// This is it
			const item = this.items[idx];

			if (!item.deleted) {
				item.deleted = true;
				if (snapshot != null) snapshot.splice(endPos, 1);
			}

			item.state = 1;

			this.delTargets[opLv] = item.clock;
		} else {
			// Insert
			const { idx, endPos } = findByCurrentPos(this.items, op.pos);

			if (idx >= 1 && this.items[idx - 1].state !== State.Inserted) {
				throw Error("Item to the left is not inserted! What!");
			}

			const originLeft = idx === 0 ? -1 : this.items[idx - 1].clock;

			// let originRight = doc.items[idx].lv
			let originRight = -1;
			for (let i = idx; i < this.items.length; i++) {
				const item2 = this.items[i];
				if (item2.state !== State.NotInserted) {
					// Use this item as our "right" item.
					originRight = item2.clock;
					break;
				}
			}

			const item: Item = {
				clock: opLv,
				originLeft,
				originRight,
				deleted: false,
				state: State.Inserted,
			};
			this.itemsByLV[opLv] = item;

			// insert it into the document list
			this.integrate(oplog, item, idx, endPos, snapshot);
		}
	}

	integrate<T>(
		oplog: OpLog<T>,
		newItem: Item,
		idx: number,
		endPos: number,
		snapshot: T[] | null,
	) {
		let scanIdx = idx;
		let scanEndPos = endPos;

		// If originLeft is -1, that means it was inserted at the start of the document.
		// We'll pretend there was some item at position -1 which we were inserted to the
		// right of.
		const left = scanIdx - 1;
		const right =
			newItem.originRight === -1
				? this.items.length
				: findItemIdxAtLV(this.items, newItem.originRight);

		let scanning = false;

		// This loop scans forward from destIdx until it finds the right place to insert into
		// the list.
		while (scanIdx < right) {
			const other = this.items[scanIdx];

			if (other.state !== State.NotInserted) break;

			const oleft =
				other.originLeft === -1
					? -1
					: findItemIdxAtLV(this.items, other.originLeft);

			const oright =
				other.originRight === -1
					? this.items.length
					: findItemIdxAtLV(this.items, other.originRight);

			// The logic below summarizes to:
			const newItemAgent = oplog.ops[newItem.clock].id.site;
			const otherAgent = oplog.ops[other.clock].id.site;

			if (
				oleft < left ||
				(oleft === left && oright === right && newItemAgent < otherAgent)
			) {
				break;
			}
			if (oleft === left) scanning = oright < right;

			if (!other.deleted) scanEndPos++;
			scanIdx++;

			if (!scanning) {
				idx = scanIdx;
				endPos = scanEndPos;
			}
		}

		// We've found the position. Insert here.
		this.items.splice(idx, 0, newItem);

		const op = oplog.ops[newItem.clock];
		if (op.type !== "ins") throw Error("Cannot insert a delete");
		if (snapshot != null) snapshot.splice(endPos, 0, op.content);
	}

	do1Operation<T>(oplog: OpLog<T>, lv: Clock, snapshot: T[] | null) {
		const op = oplog.ops[lv];

		const { aOnly, bOnly } = oplog.diff(this.currentVersion, op.parents);

		for (const i of aOnly) this.retreat(oplog, i);
		for (const i of bOnly) this.advance(oplog, i);

		this.apply(oplog, snapshot, lv);
		this.currentVersion = [lv];
	}
}

function findItemIdxAtLV(items: Item[], lv: Clock) {
	const idx = items.findIndex((item) => item.clock === lv);
	if (idx < 0) throw Error("Could not find item");
	return idx;
}

function findByCurrentPos(
	items: Item[],
	targetPos: number
): { idx: number; endPos: number } {
	let curPos = 0;
	let endPos = 0;
	let idx = 0;

	for (; curPos < targetPos; idx++) {
		if (idx >= items.length) throw Error("Past end of items list");

		const item = items[idx];
		if (item.state === State.Inserted) curPos++;
		if (!item.deleted) endPos++;
	}

	return { idx, endPos };
}

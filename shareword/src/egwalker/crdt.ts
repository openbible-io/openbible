import { opLength, opType, OpType, refDecode, refEncode } from "./op";
import type { OpLog } from "./oplog";
import type { Accumulator, OpRef, Site } from "./op";
import type { Snapshot } from "./snapshot";
import { assert } from "./util";
import { PriorityQueue } from "./util/pq";

export enum State {
	NotInserted = -1,
	Inserted = 0,
	Deleted = 1,
	// DeletedTwice = 2,
	// DeletedThrice = 3,
	// ...
}

export type Item = {
	ref: OpRef;
	length: number;
	/** For tie breaking */
	site: Site;
	/** -1 = start of doc */
	originLeft: OpRef | -1;
	/** -1 = end of doc */
	originRight: OpRef | -1;
	deleted: boolean;
	state: State;
};

/**
 * A CRDT document implemented as an Event Graph Walker.
 *
 * - https://arxiv.org/pdf/2409.14252
 */
export class Crdt<T, AccT extends Accumulator<T>> {
	items: Item[] = [];
	currentVersion: OpRef[] = [];

	delTargets: { [ref: OpRef]: OpRef } = {};
	targets: { [ref: OpRef]: Item } = {};

	constructor(public oplog: OpLog<T, AccT>) {}

	#target(ref: OpRef): Item {
		const [idx] = refDecode(ref);
		const data = this.oplog.ops.items.fields.data[idx];
		const target =
			opType(data) === OpType.Deletion ? this.delTargets[ref] : ref;
		return this.targets[target];
	}

	#retreat(ref: OpRef) {
		this.#target(ref).state -= 1;
	}

	#advance(ref: OpRef) {
		this.#target(ref).state += 1;
	}

	#findPos(
		targetPos: number,
		skipDeleted: boolean,
	): { idx: number; endPos: number } {
		let curPos = 0;
		let endPos = 0;
		let idx = 0;

		for (; curPos < targetPos; idx++) {
			if (idx >= this.items.length) throw new Error("Past end of items list");

			const item = this.items[idx];
			if (item.state === State.Inserted) curPos++;
			if (!item.deleted) endPos++;
		}

		if (skipDeleted) {
			while (this.items[idx].state !== State.Inserted) {
				if (!this.items[idx].deleted) endPos++;
				idx++;
			}
		}

		return { idx, endPos };
	}

	#apply(ref: OpRef, snapshot?: Snapshot<T>) {
		const [idx, offset] = refDecode(ref);
		const op = this.oplog.at(refEncode(idx, 0));
		const pos = op.position;

		switch (opType(op.data)) {
			case OpType.Deletion: {
				const { idx, endPos } = this.#findPos(pos, true);
				const item = this.items[idx];

				if (!item.deleted) {
					item.deleted = true;
					snapshot?.delete(endPos, -op.data);
				}
				item.state = State.Deleted;

				this.delTargets[ref] = item.ref;
				break;
			}
			case OpType.Insertion: {
				const { idx, endPos } = this.#findPos(pos, false);
				const originLeft = idx ? this.items[idx - 1].ref : -1;

				let originRight = -1;
				for (let i = idx; i < this.items.length; i++) {
					const item2 = this.items[i];
					if (item2.state !== State.NotInserted) {
						originRight = item2.ref;
						break;
					}
				}

				const item: Item = {
					ref,
					length: opLength(op.data),
					site: op.site,
					originLeft,
					originRight,
					deleted: false,
					state: State.Inserted,
				};
				this.targets[ref] = item;
				//console.log("integrate", refDecode(ref), op.data)
				this.#integrate(item, idx, endPos, op.data as AccT, snapshot);
				break;
			}
			default:
				assert(false, `invalid op ${op.data}`);
		}
	}

	#indexOfOpRef(ref: OpRef): number {
		return this.items.findIndex((item) => item.ref === ref);
	}

	/** FugueMax */
	#integrate(
		newItem: Item,
		idx: number,
		endPos: number,
		content: AccT,
		snapshot?: Snapshot<T>,
	) {
		let scanIdx = idx;
		let scanEndPos = endPos;

		const left = scanIdx - 1;
		const right =
			newItem.originRight === -1
				? this.items.length
				: this.#indexOfOpRef(newItem.originRight);

		let scanning = false;

		while (scanIdx < right) {
			const other = this.items[scanIdx];
			if (other.state !== State.NotInserted) break;

			const oleft = this.#indexOfOpRef(other.originLeft);
			const oright =
				other.originRight === -1
					? this.items.length
					: this.#indexOfOpRef(other.originRight);

			if (
				oleft < left ||
				(oleft === left && oright === right && newItem.site < other.site)
			) {
				break;
			}
			if (oleft === left) scanning = oright < right;

			if (!other.deleted) scanEndPos += other.length;
			scanIdx++;

			if (!scanning) {
				idx = scanIdx;
				endPos = scanEndPos;
			}
		}

		this.items.splice(idx, 0, newItem);
		snapshot?.insert(endPos, content);
	}

	#diff(a: OpRef[], b: OpRef[]): { aOnly: OpRef[]; bOnly: OpRef[] } {
		type DiffFlag = "a" | "b" | "both";
		const flags: { [ref: OpRef]: DiffFlag } = {};
		const queue = new PriorityQueue<OpRef>((a, b) => b - a);
		let numShared = 0;

		function enq(v: OpRef, flag: DiffFlag) {
			const oldFlag = flags[v];
			if (oldFlag == null) {
				queue.push(v);
				flags[v] = flag;
				if (flag === "both") numShared++;
			} else if (flag !== oldFlag && oldFlag !== "both") {
				flags[v] = "both";
				numShared++;
			}
		}

		for (const aa of a) enq(aa, "a");
		for (const bb of b) enq(bb, "b");

		const aOnly: OpRef[] = [];
		const bOnly: OpRef[] = [];

		while (queue.length > numShared) {
			// biome-ignore lint/style/noNonNullAssertion: size check above
			const ref = queue.pop()!;
			const flag = flags[ref];

			if (flag === "a") aOnly.push(ref);
			else if (flag === "b") bOnly.push(ref);
			else numShared--;

			for (const p of this.oplog.parentsAt(ref)) enq(p, flag);
		}

		return { aOnly, bOnly };
	}

	applyOp(ref: OpRef, snapshot?: Snapshot<T>) {
		//console.log("applyOp", refDecode(ref))
		const parents = this.oplog.parentsAt(ref);
		const { aOnly, bOnly } = this.#diff(this.currentVersion, parents);
		//if (aOnly.length || bOnly.length)
		//	console.log({ aOnly: aOnly.map(refDecode), bOnly: bOnly.map(refDecode) });

		for (const ref of aOnly) this.#retreat(ref);
		for (const ref of bOnly) this.#advance(ref);
//refEncode(refDecode(ref)[0], 0)
		this.#apply(ref, snapshot);
		this.currentVersion = [ref];
	}
}

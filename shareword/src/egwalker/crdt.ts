import type { OpLog } from "./oplog";
import type { Accumulator, Clock } from "./oplog-rle";
import type { Snapshot } from "./snapshot";
import PriorityQueue from "./util/pq";

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
	/** -1 = start of doc */
	originLeft: Clock | -1;
	/** -1 = end of doc */
	originRight: Clock | -1;
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
	currentVersion: Clock[] = [];

	delTargets: { [clock: Clock]: Clock } = {};
	targets: { [clock: Clock]: Item } = {};

	constructor(public oplog: OpLog<T, AccT>) {}

	#target(clock: Clock): Item {
		const target = this.oplog.getDeleted(clock)
			? this.delTargets[clock]
			: clock;
		return this.targets[target];
	}

	#retreat(clock: Clock) {
		this.#target(clock).state -= 1;
	}

	#advance(clock: Clock) {
		this.#target(clock).state += 1;
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

	#apply(clock: Clock, snapshot?: Snapshot<T>) {
		const pos = this.oplog.getPos(clock);

		if (this.oplog.getDeleted(clock)) {
			const { idx, endPos } = this.#findPos(pos, true);
			const item = this.items[idx];

			if (!item.deleted) {
				item.deleted = true;
				snapshot?.delete(endPos, 1);
			}
			item.state = State.Deleted;

			this.delTargets[clock] = item.clock;
		} else {
			const content = this.oplog.getItem(clock);
			const { idx, endPos } = this.#findPos(pos, false);
			const originLeft = idx ? this.items[idx - 1].clock : -1;

			let originRight = -1;
			for (let i = idx; i < this.items.length; i++) {
				const item2 = this.items[i];
				if (item2.state !== State.NotInserted) {
					originRight = item2.clock;
					break;
				}
			}

			const item: Item = {
				clock,
				originLeft,
				originRight,
				deleted: false,
				state: State.Inserted,
			};
			this.targets[clock] = item;
			this.#integrate(item, idx, endPos, content, snapshot);
		}
	}

	#indexOfLocalClock(clock: Clock) {
		return this.items.findIndex((item) => item.clock === clock);
	}

	/** FugueMax */
	#integrate(
		newItem: Item,
		idx: number,
		endPos: number,
		content: T,
		snapshot?: Snapshot<T>,
	) {
		let scanIdx = idx;
		let scanEndPos = endPos;

		const left = scanIdx - 1;
		const right =
			newItem.originRight === -1
				? this.items.length
				: this.#indexOfLocalClock(newItem.originRight);

		let scanning = false;

		while (scanIdx < right) {
			const other = this.items[scanIdx];
			if (other.state !== State.NotInserted) break;

			const oleft = this.#indexOfLocalClock(other.originLeft);
			const oright =
				other.originRight === -1
					? this.items.length
					: this.#indexOfLocalClock(other.originRight);

			const newSite = this.oplog.getSite(newItem.clock);
			const otherSite = this.oplog.getSite(other.clock);

			if (
				oleft < left ||
				(oleft === left && oright === right && newSite < otherSite)
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

		this.items.splice(idx, 0, newItem);
		snapshot?.insert(endPos, [content]);
	}

	#diff(a: Clock[], b: Clock[]): { aOnly: Clock[]; bOnly: Clock[] } {
		type DiffFlag = "a" | "b" | "both";
		const flags: { [clock: Clock]: DiffFlag } = {};
		const queue = new PriorityQueue<Clock>((a, b) => b - a);
		let numShared = 0;

		function enq(v: Clock, flag: DiffFlag) {
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

		const aOnly: Clock[] = [];
		const bOnly: Clock[] = [];

		while (queue.length > numShared) {
			// biome-ignore lint/style/noNonNullAssertion: size check above
			const clock = queue.pop()!;
			const flag = flags[clock];

			if (flag === "a") aOnly.push(clock);
			else if (flag === "b") bOnly.push(clock);
			else numShared--;

			for (const p of this.oplog.getParents(clock)) enq(p, flag);
		}

		return { aOnly, bOnly };
	}

	applyOp(clock: Clock, snapshot?: Snapshot<T>) {
		const parents = this.oplog.getParents(clock);
		const { aOnly, bOnly } = this.#diff(this.currentVersion, parents);

		for (const i of aOnly) this.#retreat(i);
		for (const i of bOnly) this.#advance(i);

		this.#apply(clock, snapshot);
		this.currentVersion = [clock];
	}
}

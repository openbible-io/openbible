import type { OpLog } from "./oplog";
import type { Clock } from "./util/state-vector";

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
 * - https://arxiv.org/pdf/2409.14252
 */
export class EgWalker<T, ArrT extends ArrayLike<T>> {
	items: Item[] = [];
	currentVersion: Clock[] = [];

	delTargets: { [clock: Clock]: Clock } = {};
	targets: { [clock: Clock]: Item } = {};

	#target(oplog: OpLog<T, ArrT>, clock: Clock): Item {
		const target = oplog.getDeleted(clock) ? this.delTargets[clock] : clock;
		return this.targets[target];
	}

	#retreat(oplog: OpLog<T, ArrT>, clock: Clock) {
		this.#target(oplog, clock).state -= 1;
	}

	#advance(oplog: OpLog<T, ArrT>, clock: Clock) {
		this.#target(oplog, clock).state += 1;
	}

	#apply(oplog: OpLog<T, ArrT>, clock: Clock, snapshot?: T[]) {
		const pos = oplog.getPos(clock);

		if (oplog.getDeleted(clock)) {
			const { idx, endPos } = this.#findPos(pos, true);
			const item = this.items[idx];

			if (!item.deleted) {
				item.deleted = true;
				snapshot?.splice(endPos, 1);
			}
			item.state = State.Deleted;

			this.delTargets[clock] = item.clock;
		} else {
			const content = oplog.getContent(clock);
			const { idx, endPos } = this.#findPos(pos, false);
			const originLeft = idx === 0 ? -1 : this.items[idx - 1].clock;

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

			this.#integrate(oplog, item, idx, endPos, content, snapshot);
		}
	}

	/** FugueMax */
	#integrate(
		oplog: OpLog<T, ArrT>,
		newItem: Item,
		idx: number,
		endPos: number,
		content: T,
		snapshot?: T[],
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

			const newSite = oplog.getId(newItem.clock).site;
			const otherSite = oplog.getId(other.clock).site;

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
		snapshot?.splice(endPos, 0, content);
	}

	#indexOfLocalClock(clock: Clock) {
		return this.items.findIndex((item) => item.clock === clock);
	}

	#findPos(
		targetPos: number,
		skipDeleted: boolean,
	): { idx: number; endPos: number } {
		let curPos = 0;
		let endPos = 0;
		let idx = 0;

		for (; curPos < targetPos; idx++) {
			if (idx >= this.items.length) throw Error("Past end of items list");

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

	doOp(oplog: OpLog<T, ArrT>, clock: Clock, snapshot?: T[]) {
		const parents = oplog.getParents(clock);
		const { aOnly, bOnly } = oplog.diff(this.currentVersion, parents);

		for (const i of aOnly) this.#retreat(oplog, i);
		for (const i of bOnly) this.#advance(oplog, i);

		this.#apply(oplog, clock, snapshot);
		this.currentVersion = [clock];
	}
}

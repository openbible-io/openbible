import type { Accumulator, OpRef, Site } from "./op";
import type { Snapshot } from "./snapshot";
import { assertBounds } from "./util";

export enum State {
	NotInserted = -1,
	Inserted = 0,
	Deleted = 1,
	// DeletedTwice = 2,
	// DeletedThrice = 3,
	// ...
}

/** An item that may conflict. */
export type Item = {
	ref: OpRef;
	/** -1 = start of doc */
	originLeft: OpRef | -1;
	/** -1 = end of doc */
	originRight: OpRef | -1;
	deleted: boolean;
	state: State;
};

export class CrdtList<T, AccT extends Accumulator<T>> {
	#items: Item[] = [];
	#targets: Record<OpRef, Item> = {};

	constructor(
		private getSite: (ref: OpRef) => Site,
		placeholderOffset: number,
		placeholderLength: number,
	) {
		for (let i = 0; i < placeholderLength; i++) {
			const item: Item = {
				ref: placeholderOffset + i,
				originLeft: -1,
				originRight: -1,
				deleted: false,
				state: State.Inserted,
			};
			this.#items.push(item);
			this.#targets[item.ref] = item;
		}
	}

	#findPos(
		targetPos: number,
		skipDeleted: boolean,
	): { idx: number; endPos: number } {
		let curPos = 0;
		let endPos = 0;
		let idx = 0;

		for (; curPos < targetPos; idx++) {
			assertBounds(idx, this.#items.length);

			const item = this.#items[idx];
			if (item.state === State.Inserted) curPos++;
			if (!item.deleted) endPos++;
		}

		if (skipDeleted) {
			while (this.#items[idx].state !== State.Inserted) {
				if (!this.#items[idx].deleted) endPos++;
				idx++;
			}
		}

		return { idx, endPos };
	}

	#indexOfOpRef(ref: OpRef): number {
		return this.#items.findIndex((item) => item.ref === ref);
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
				? this.#items.length
				: this.#indexOfOpRef(newItem.originRight);

		let scanning = false;

		while (scanIdx < right) {
			const other = this.#items[scanIdx];
			if (other.state !== State.NotInserted) break;

			const oleft = this.#indexOfOpRef(other.originLeft);
			const oright =
				other.originRight === -1
					? this.#items.length
					: this.#indexOfOpRef(other.originRight);

			if (
				oleft < left ||
				(oleft === left &&
					oright === right &&
					this.getSite(newItem.ref) < this.getSite(other.ref))
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

		this.#items.splice(idx, 0, newItem);
		snapshot?.insert(endPos, content);
	}

	insert(
		ref: OpRef,
		pos: number,
		data: AccT,
		snapshot?: Snapshot<T>,
	): void {
		const { idx, endPos } = this.#findPos(pos, false);
		const originLeft = idx ? this.#items[idx - 1].ref : -1;

		let originRight = -1;
		for (let i = idx; i < this.#items.length; i++) {
			const item2 = this.#items[i];
			if (item2.state !== State.NotInserted) {
				originRight = item2.ref;
				break;
			}
		}

		const item: Item = {
			ref,
			originLeft,
			originRight,
			deleted: false,
			state: State.Inserted,
		};
		this.#targets[ref] = item;
		this.#integrate(item, idx, endPos, data, snapshot);
		//console.log("insert", ref, pos, data);
		//console.table(this.#items);
	}

	delete(ref: OpRef, pos: number, count: number, snapshot?: Snapshot<T>): void {
		const { idx, endPos } = this.#findPos(pos, true);
		const item = this.#items[idx];

		if (!item.deleted) {
			item.deleted = true;
			snapshot?.delete(endPos, count);
		}
		item.state = State.Deleted;

		this.#targets[ref] = item;
		//console.log("delete", ref, pos);
		//console.table(this.#items);
	}

	retreat(ref: OpRef) {
		//console.log("retreat", refDecode(ref));
		this.#targets[ref].state -= 1;
	}

	advance(ref: OpRef) {
		//console.log("advance", refDecode(ref));
		this.#targets[ref].state += 1;
	}
}

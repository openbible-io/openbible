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
	/** From document */
	deleted: boolean;
	originLeft: Item | null;
	originRight: Item | null;
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
				originLeft: null,
				originRight: null,
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
	): { crdtIdx: number; docIdx: number } {
		assertBounds(targetPos, this.#items.length);
		const res = { crdtIdx: 0, docIdx: 0 };

		for (let i = 0; i < targetPos; res.crdtIdx++) {
			assertBounds(res.crdtIdx, this.#items.length);
			const item = this.#items[res.crdtIdx];

			if (item.state === State.Inserted) i++;
			if (!item.deleted) res.docIdx++;
		}

		if (skipDeleted) {
			for (; this.#items[res.crdtIdx].state !== State.Inserted; res.crdtIdx++)
				if (!this.#items[res.crdtIdx].deleted) res.docIdx++;
		}

		return res;
	}

	indexRight(newItem: Item): number {
		return newItem.originRight
			? this.#items.indexOf(newItem.originRight)
			: this.#items.length;
	}

	indexLeft(newItem: Item): number {
		return newItem.originLeft ? this.#items.indexOf(newItem.originLeft) : -1;
	}

	/** FugueMax */
	#integrate(newItem: Item, crdtIdx: number, docIdx: number) {
		let scanIdx = crdtIdx;
		let scanEndPos = docIdx;
		let scanning = false;
		const left = scanIdx - 1;
		const right = this.indexRight(newItem);

		while (scanIdx < right) {
			const other = this.#items[scanIdx];
			if (other.state !== State.NotInserted) break;

			const oleft = this.indexLeft(other);
			if (oleft < left) break;

			const oright = this.indexRight(other);
			if (
				oleft === left &&
				oright === right &&
				this.getSite(newItem.ref) < this.getSite(other.ref)
			)
				break;

			if (oleft === left) scanning = oright < right;
			if (!other.deleted) scanEndPos++;

			scanIdx++;

			if (!scanning) {
				crdtIdx = scanIdx;
				docIdx = scanEndPos;
			}
		}

		return { crdtIdx, docIdx };
	}

	insert(ref: OpRef, pos: number, data: AccT, snapshot?: Snapshot<T>): void {
		const { crdtIdx, docIdx } = this.#findPos(pos, false);
		const originLeft = crdtIdx ? this.#items[crdtIdx - 1] : null;

		let originRight = null;
		for (let i = crdtIdx; i < this.#items.length; i++) {
			const item2 = this.#items[i];
			if (item2.state !== State.NotInserted) {
				originRight = item2;
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

		const stable = this.#integrate(item, crdtIdx, docIdx);
		this.#items.splice(stable.crdtIdx, 0, item);
		snapshot?.insert(stable.docIdx, data);
		//console.log("insert", ref, pos, data);
		//console.table(this.#items);
	}

	delete(ref: OpRef, pos: number, count: number, snapshot?: Snapshot<T>): void {
		const { crdtIdx, docIdx } = this.#findPos(pos, true);
		const item = this.#items[crdtIdx];

		if (!item.deleted) snapshot?.delete(docIdx, count);
		item.deleted = true;
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

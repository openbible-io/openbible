import { BTree } from "./util";
import { State, type Item } from "./crdt-list";
import { opLength, type Accumulator, type OpData, type OpRef } from "./op";
import type { Snapshot } from "./snapshot";

export class CrdtTree<T, AccT extends Accumulator<T>> {
	doc = new BTree<Item>((item, start) => ({
		ref: item.ref + start,
		originLeft: item.originLeft + start,
		originRight: item.originRight,
		deleted: item.deleted,
		state: item.state,
	}));

	#insertOrDelete(ref: OpRef, pos: number, data: OpData<T, AccT>): { item: Item, docPos: number } {
		const item: Item = {
			ref,
			originLeft: -1,
			originRight: -1,
			deleted: false,
			state: State.Inserted,
		};
		this.doc.insert(pos, item, opLength(data));

		return { item, docPos: pos };
	}

	/** FugueMax */
	#integrate(newItem: Item, idx: number, endPos: number): { idx: number, endPos: number } {
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

		return { idx, endPos };
	}

	insert(
		ref: OpRef,
		pos: number,
		data: AccT,
		snapshot?: Snapshot<T>,
	): void {
		const { item, docPos } = this.#insertOrDelete(ref, pos, data);

		const left = this.doc.get(docPos - 1); 
		if (left) item.originLeft = left.ref;
		for (const right of this.doc.iter(docPos)) {
			if (right.value.state !== State.NotInserted) {
				item.originRight = right.value.ref;
				break;
			}
		}

		const stablePos = this.#integrate(item, idx, endPos);
		this.#items.splice(stablePos.idx, 0, item);
		snapshot?.insert(stablePos.endPos, data);
	}

	delete(ref: OpRef, pos: number, count: number, snapshot?: Snapshot<T>): void {
		const { item, docPos } = this.#insertOrDelete(ref, pos, -count);

		if (!item.deleted) {
			item.deleted = true;
			snapshot?.delete(docPos, count);
		}
		item.state = State.Deleted;

		snapshot?.delete(docPos, count);
	}

	retreat(ref: OpRef) {
		//console.log("retreat", refDecode(ref));
		//this.#targets[ref].state -= 1;
	}

	advance(ref: OpRef) {
		//console.log("advance", refDecode(ref));
		//this.#targets[ref].state += 1;
	}
}

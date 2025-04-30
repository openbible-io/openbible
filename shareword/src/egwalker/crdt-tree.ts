import { BTree } from "./util";
import { State, type Item } from "./crdt-list";
import { opLength, type Accumulator, type OpData, type OpRef } from "./op";
import type { Snapshot } from "./snapshot";

export class CrdtTree<T, AccT extends Accumulator<T>> {
	tree = new BTree<Item>((item, start) => ({
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
		this.tree.insert(pos, item, opLength(data));

		return { item, docPos: pos };
	}

	insert(
		ref: OpRef,
		pos: number,
		data: AccT,
		snapshot?: Snapshot<T>,
	): void {
		const { item, docPos } = this.#insertOrDelete(ref, pos, data);

		// Set originLeft and originRight
		for (const left of this.tree.iter(0, docPos)) {
			item.originLeft = left.ref;
			break;
		}

		for (const right of this.tree.iter(docPos)) {
			if (right.state !== State.NotInserted) {
				item.originRight = right.ref;
				break;
			}
		}

		//this.#integrate(item, idx, endPos, data, snapshot);
	}

	delete(ref: OpRef, pos: number, count: number, snapshot?: Snapshot<T>): void {
		const { item, docPos } = this.#insertOrDelete(ref, pos, -count);

		if (!item.deleted) {
			item.deleted = true;
			snapshot?.delete(docPos, count);
		}
		item.state = State.Deleted;
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

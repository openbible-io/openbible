import { BTree } from "./util";
import type { Item } from "./crdt-list";
import type { Accumulator, OpRef } from "./op";
import type { Snapshot } from "./snapshot";

/**
 * An order statistic tree.
 *
 */
export class CrdtTree<T, AccT extends Accumulator<T>> {
	tree = new BTree<OpRef, Item>((a, b) => a - b);

	insert(
		ref: OpRef,
		pos: number,
		data: AccT,
		snapshot?: Snapshot<T>,
	): void {
		const docPos = this.#insertOrDelete(ref, pos, data);
		snapshot?.insert(docPos, data);
	}

	delete(ref: OpRef, pos: number, count: number, snapshot?: Snapshot<T>): void {
		const docPos = this.#insertOrDelete(ref, pos, count);
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

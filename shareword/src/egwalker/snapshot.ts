import type { Accumulator } from "./oplog-rle";

/** A type which diffs apply to. */
export interface Snapshot<T> {
	insert(pos: number, items: Accumulator<T>): void;
	delete(pos: number, delCount: number): void;
	get length(): number;
	items(): Generator<T>;
}

// Simple and slow once `data` grows.
export class ListSnapshot<T> implements Snapshot<T> {
	data: T[] = [];

	insert(pos: number, items: Accumulator<T>) {
		this.data.splice(pos, 0, ...items);
	}

	delete(pos: number, delCount: number) {
		this.data.splice(pos, delCount);
	}

	get length() {
		return this.data.length;
	}

	*items() {
		for (const d of this.data) yield d;
	}
}

//import BTree from "./util/btree";
//class BTreeSnapshot<T, AccT extends Accumulator<T>> implements Snapshot<T> {
//	snapshot = new BTree<Clock, T>((a, b) => a - b);
//
//	constructor(private mergeFn: (acc: AccT, cur: AccT) => AccT) {}
//
//	insert(pos: number, items: T) {
//		for (let i = 0; i < items.length; i++) {
//			console.log("insert", pos + i, items[i]);
//			this.snapshot.set(pos + i, items[i]);
//		}
//	}
//
//	delete(pos: number, delCount: number) {
//		for (let i = 0; i < delCount; i++) {
//			console.log("delete", pos + i);
//			this.snapshot.delete(pos + i);
//		}
//	}
//
//	get length() {
//		return this.snapshot.length;
//	}
//
//	*items() {
//		yield* this.snapshot.values();
//	}
//}

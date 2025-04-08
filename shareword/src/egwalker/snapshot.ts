import type { Accumulator } from "./op";

/** A type which diffs apply to. */
export interface Snapshot<T> {
	insert(pos: number, items: Accumulator<T>): void;
	delete(pos: number, delCount: number): void;
	get length(): number;
	items(): Generator<T>;
}

// Simple, but slow once `data` grows. The default.
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

// Should be best for browsers.
export class HtmlSnapshot implements Snapshot<string> {
	constructor(public element: CharacterData) {
		this.#ensureTrailingNewline();
	}

	/** Fixes browser bug of inserting paragraph at end. */
	#ensureTrailingNewline() {
		if (this.element.data[this.element.length - 1] !== "\n") {
			this.element.appendData("\n");
		}
	}

	insert(pos: number, items: string) {
		this.#ensureTrailingNewline();
		this.element.insertData(pos, items);
	}

	delete(pos: number, delCount: number) {
		this.element.replaceData(pos, delCount, "");
	}

	get length() {
		return this.element.length;
	}

	*items() {
		yield this.element.data;
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

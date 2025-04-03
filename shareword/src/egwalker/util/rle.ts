import { assert } from "./assert";
import { binarySearch } from "./bsearch";

export type Range = { start: number; len: number };

export interface Container<T> {
	at(i: number): T | undefined;
	push(item: T): void;
	slice(start?: number, end?: number): this;
}

/** Run length encoded list. */
export class Rle<T, C extends Container<T> = Array<T>> {
	startIdxs: number[] = [];
	length = 0;

	/**
	 * @param items The container type to push `T`s to.
	 * @param appendItem Function that returns true if it appends `item` to `ctx`.
	 * @param sliceItem Slices an item for range functions.
	 */
	constructor(
		public items: C,
		private appendItem: (ctx: Rle<T, C>, item: T, len: number) => boolean,
		private sliceItem: (item: T, start?: number, end?: number) => T,
	) {}

	get lengthCompressed() {
		return this.startIdxs.length;
	}

	/** Pushes `item` of `len` */
	push(item: T, len = 1): void {
		if (!this.length || !this.appendItem(this, item, len)) {
			this.items.push(item);
			this.startIdxs.push(this.length);
		}
		this.length += len;
	}

	len(idx: number): number {
		if (idx > this.lengthCompressed) return 0;
		return (this.startIdxs[idx + 1] ?? this.length) - this.startIdxs[idx];
	}

	#rangeIndex(idx: number): number {
		if (!idx && this.length) return idx;

		return binarySearch(
			this.startIdxs,
			idx,
			(start, needle, i) => {
				if (start > needle) return 1;
				const len = this.len(i);
				if (start + len <= needle) return -1;
				return 0;
			},
			0,
		);
	}

	offsetOf(i: number): { idx: number; offset: number } {
		const idx = this.#rangeIndex(i);
		return {
			idx,
			offset: i - this.startIdxs[idx],
		};
	}

	at(i: number): T | undefined {
		const { idx, offset } = this.offsetOf(i);
		const item = this.items.at(idx);
		if (item === undefined) return;
		return this.sliceItem(item, offset, offset + 1);
	}

	*runs(
		start = 0,
		end = this.length,
		startOff = this.offsetOf(start),
	): Generator<{ idx: number; len: number; item: T }> {
		assert(end >= start, "backwards slice");

		let visited = 0;

		for (
			let i = startOff.idx;
			visited < end - start;
			i++
		) {
			let item = this.items.at(i);
			assert(item !== undefined, `index ${i} out of bounds`);

			let len = this.len(i);
			if (visited >= end - start) {
				const offset = visited + len - end;
				item = this.sliceItem(item, 0, offset);
				len -= offset;
			}
			if (i === startOff.idx) {
				item = this.sliceItem(item, startOff.offset);
				len -= startOff.offset;
			}
			yield { idx: i, len, item };
			visited += len;
		}
	}

	slice(start = 0, end = this.length): Rle<T, C> {
		const res = new Rle<T, C>(this.items, this.appendItem, this.sliceItem);
		// Wish I could `.slice()` this.items, but then cannot slice first/last
		// items without introducting a problematic `.set(k,v)` that doesn't
		// exist on Array and String.
		res.items = res.items.slice(0, 0);
		for (const { item } of this.runs(start, end)) res.push(item);

		return res;
	}
}

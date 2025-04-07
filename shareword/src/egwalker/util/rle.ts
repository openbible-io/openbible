import binarySearch from "./bsearch";
import { MultiArrayList } from "./multi-array-list";

export type Range = { start: number; len: number };

export interface Container<T> {
	at(i: number): T | undefined;
	push(item: T): void;
	length: number;
}

/**
 * Run length encoded list.
 *
 * Allows negative lengths to store an extra bit.
 */
export class Rle<T, C extends Container<T> = Array<T>> {
	ranges = new MultiArrayList<Range>({ start: 0, len: 0 });

	/**
	 * @param items The container type to use.
	 * @param append Function that returns true if appends `cur` to `items`
	 */
	constructor(
		public items: C,
		private append: (ctx: Rle<T, C>, item: T, len: number) => boolean,
	) {}

	/**
	 * Pushes `item` of `len`.
	 *
	 * @returns If appended to previous item.
	 */
	push(item: T, len = 1): void {
		if (!len) return;

		if (this.length && this.append(this, item, len)) {
			const lens = this.ranges.fields.len;
			lens[lens.length - 1] += len;
		} else {
			this.items.push(item);
			this.ranges.push({ start: this.length, len });
		}
	}

	len(idx: number): number {
		return Math.abs(this.ranges.fields.len[idx]);
	}

	#rangeIndex(idx: number): number {
		return binarySearch(
			this.ranges.fields.start,
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
		if (idx >= this.ranges.length) throw new Error(`${i} out of bounds`);
		const start = this.ranges.fields.start[idx];
		const offset = i - start;
		return { idx, offset };
	}

	at(i: number): T | undefined {
		return this.items.at(this.#rangeIndex(i));
	}

	get length() {
		if (!this.ranges.length) return 0;

		return (
			this.ranges.fields.start[this.ranges.length - 1] +
			this.len(this.ranges.length - 1)
		);
	}
}

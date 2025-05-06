import { assert, assertBounds } from "./assert";
import { binarySearch } from "./bsearch";

export type Range = { start: number; len: number };

export interface Container<T> {
	at(i: number): T | undefined;
	push(item: T): void;
	slice(start?: number, end?: number): this;
	length: number;
}

/** Run length encoded list. */
export class Rle<T, C extends Container<T> = Array<T>> {
	offsets: number[] = [];
	/** Sum of all items' lengths. */
	count = 0;

	/** Number of items. */
	get length(): number {
		return this.offsets.length;
	}

	/**
	 * @param items The container type to use.
	 * @param append Function that returns true if appends `cur` to `items`
	 */
	constructor(
		public items: C,
		private append: (ctx: Rle<T, C>, item: T, len: number) => boolean,
		private sliceFn: (item: T, start?: number, end?: number) => T,
	) {}

	/**
	 * Pushes `item` of `len`.
	 *
	 * @returns If appended to previous item.
	 */
	push(item: T, len = 1, forceNewRun = !this.count): void {
		if (!len) return;

		if (forceNewRun || !this.append(this, item, len)) {
			this.items.push(item);
			this.offsets.push(this.count);
		}
		this.count += len;
	}

	len(idx: number): number {
		assertBounds(idx, this.offsets.length);
		const nextIdx = this.offsets[idx + 1] ?? this.count;
		return nextIdx - this.offsets[idx];
	}

	indexOf(i: number): { idx: number; offset: number } {
		const idx = binarySearch(
			this.offsets,
			i,
			(start, needle, i) => {
				if (start > needle) return 1;
				const len = this.len(i);
				if (start + len <= needle) return -1;
				return 0;
			},
			0,
		);
		assertBounds(idx, this.offsets.length);

		return { idx, offset: i - this.offsets[idx] };
	}

	at(i: number): T {
		const { idx, offset } = this.indexOf(i);
		const res = this.items.at(idx);
		assert(res !== undefined, `undefined was inserted into RLE at ${idx}`);
		return this.sliceFn(res, offset, offset + 1);
	}
}

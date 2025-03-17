import binarySearch from "./bsearch";
import { MultiArrayList } from "./multi-array-list";

export type Range = { start: number; len: number };

export interface Container<T> {
	at(i: number): T | undefined;
	push(item: T): void;
	length: number;
}

/** A container for run length encoding. */
export class Rle<T, C extends Container<T> = Array<T>> {
	ranges = new MultiArrayList<Range>({ start: 0, len: 0 });

	/**
	 * @param items The container type to use.
	 * @param append Function that returns true if appends `cur` to `items`
	*/
	constructor(
		public items: C,
		private append: (
			items: C,
			cur: T,
			lastRange?: Range,
		) => boolean,
	) {}

	/**
	 * Pushes `item` of `len`.
	 *
	 * @returns If appended to previous item.
	*/
	push(item: T, len = 1): boolean {
		if (len <= 0) return false;

		const lastRange = this.ranges.at(this.ranges.length - 1);

		if (this.append(this.items, item, lastRange)) {
			const lens = this.ranges.fields.len;
			lens[lens.length - 1] += len;
			return true;
		}

		this.items.push(item);
		this.ranges.push({ start: this.length, len });
		return false
	}

	#rangeIndex(idx: number): number {
		return binarySearch(
			this.ranges.fields.start,
			idx,
			(start, needle, i) => {
				if (start > needle) return 1;
				const len = this.ranges.fields.len[i];
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
		const lastRange = this.ranges.at(this.ranges.length - 1);
		return lastRange ? lastRange.start + lastRange.len : 0;
	}
}

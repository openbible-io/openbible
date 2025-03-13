import binarySearch from "./bsearch";
import { MultiArrayList } from "./multi-array-list";

type Range = { start: number; len: number };

interface Container<T> {
	at(i: number): T | undefined;
	push(item: T): void;
	length: number;
}

/** A container for run length encoding. */
export class Rle<T, C extends Container<T> = Array<T>> {
	ranges = new MultiArrayList<Range>({ start: 0, len: 0 });

	/**
	 * @param items The container type to use.
	 * @param append Function that attempts to append `cur` to `items
	*/
	constructor(
		public items: C,
		private append: (
			items: C,
			cur: T,
			lastRange?: Range,
		) => { curLen: number; appended: boolean },
	) {}

	push(item: T) {
		const lastRange = this.ranges.at(this.ranges.length - 1);
		const { curLen, appended } = this.append(this.items, item, lastRange);
		if (appended) {
			// hooray, we appended to a run!
			const lens = this.ranges.fields.len;
			lens[lens.length - 1] += curLen;
		} else {
			this.items.push(item);
			this.ranges.push({ start: this.length, len: curLen });
		}
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

	offsetOf(idx: number): { idx: number; offset: number } {
		const rIdx = this.#rangeIndex(idx);
		const offset = idx - rIdx;
		return { idx: rIdx, offset };
	}

	at(idx: number): T | undefined {
		const item = this.items.at(this.#rangeIndex(idx));
		return item;
	}

	get length() {
		const lastRange = this.ranges.at(this.ranges.length - 1);
		return lastRange ? lastRange.start + lastRange.len : 0;
	}
}

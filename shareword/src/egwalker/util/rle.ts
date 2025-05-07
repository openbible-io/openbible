import { assertBounds } from "./assert";
import { binarySearch } from "./bsearch";

// export interface Container<T> {
// 	at(i: number): T | undefined;
// 	push(item: T): void;
// 	slice(start?: number, end?: number): this;
// 	length: number;
// }

/** Run length encoded list. */
export class Rle<T> {
	items: T[] = [];
	offsets: number[] = [];

	/** Sum of all decoded items' lengths. */
	count = 0;

	/** Number of encoded items. */
	get length(): number {
		return this.offsets.length;
	}

	/** @param append Function that returns true if appends `cur` to `items` */
	constructor(
		private append: (ctx: Rle<T>, item: T, len: number) => boolean,
		private sliceFn: (item: T, start?: number, end?: number) => T,
	) {}

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
		if (idx === this.length)
			return {
				idx: this.length - 1,
				offset: this.count - this.offsets[this.length - 1],
			};

		return { idx, offset: i - this.offsets[idx] };
	}

	slice(from = 0, to = this.count): Rle<T> {
		if (from < 0) from = 0;
		if (to > this.count) to = this.count;

		const start = this.indexOf(from);
		const end = this.indexOf(to);
		end.idx += 1;

		const res = new Rle(this.append, this.sliceFn);
		res.items = this.items.slice(start.idx, end.idx);
		res.offsets = this.offsets.slice(start.idx, end.idx).map(o => o - from);
		res.count = to - from;

		if (res.items.length) {
			res.items[res.items.length - 1] = this.sliceFn(
				res.items[res.items.length - 1],
				0,
				end.offset,
			);
			res.items[0] = this.sliceFn(res.items[0], start.offset);
			res.offsets[0] = 0;
		}

		return res;
	}
}

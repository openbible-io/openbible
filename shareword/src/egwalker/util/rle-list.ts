import bsearch from "./bsearch";

type Comparator<T, B> = (
	a: T,
	b: B,
	index: number,
	haystack: ArrayLike<T>,
) => number;

export class RleList<T> {
	items: T[] = [];
	length = 0;

	push(item: T, tryAppend: (prev: T, cur: T) => boolean) {
		const last = this.last();
		if (!last || !tryAppend(last, item)) this.items.push(item);
		this.length += 1;
	}

	insert(
		newItem: T,
		getKey: (e: T) => number,
		tryAppend: (prev: T, cur: T) => boolean,
	) {
		const list = this.items;
		const newKey = getKey(newItem);
		if (list.length === 0 || newKey >= getKey(list[list.length - 1])) {
			this.push(newItem, tryAppend);
		} else {
			let idx = bsearch(
				list,
				newKey,
				(entry, needle) => getKey(entry) - needle,
			);
			if (idx >= 0) throw "Invalid state - item already exists";

			idx = ~idx;

			if (idx === 0 || !tryAppend(list[idx - 1], newItem)) {
				list.splice(idx, 0, newItem);
				this.length += 1;
			}
		}
	}

	last(): T | undefined {
		return this.items[this.items.length - 1];
	}

	findIndex<B>(needle: B, comparator: Comparator<T, B>): number {
		return bsearch(this.items, needle, comparator);
	}

	find<B>(needle: B, comparator: Comparator<T, B>): T | undefined {
		const idx = this.findIndex(needle, comparator);
		if (idx < 0) return;
		return this.items[idx];
	}
}

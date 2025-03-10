// Most operations apply to continous runs. Observe the following example where
// site "a" types "hello" and site "b" types "world":
//┌──────────────┬────┬─────┬─────┬─────┬─────┬────┬─────┬─────┬─────┬─────┐
//│       clock  │ 0  │ 1   │ 2   │ 3   │ 4   │ 5  │ 6   │ 7   │ 8   │ 9   │
//├──────────────┼────┼─────┼─────┼─────┼─────┼────┼─────┼─────┼─────┼─────┤
//│        sites │ a  │ a   │ a   │ a   │ a   │ b  │ b   │ b   │ b   │ b   │
//│       clocks │ 0  │ 1   │ 2   │ 3   │ 4   │ 0  │ 1   │ 2   │ 3   │ 4   │
//│      parents │ [] │ [0] │ [1] │ [2] │ [3] │ [] │ [5] │ [6] │ [7] │ [8] │
//│    positions │ 0  │ 1   │ 2   │ 3   │ 4   │ 0  │ 1   │ 2   │ 3   │ 4   │
//│ deleteCounts │ 0  │ 0   │ 0   │ 0   │ 0   │ 0  │ 0   │ 0   │ 0   │ 0   │
//│        items │ h  │ e   │ l   │ l   │ o   │ w  │ o   │ r   │ l   │ d   │
//└──────────────┴────┴─────┴─────┴─────┴─────┴────┴─────┴─────┴─────┴─────┘
//
// We can encode it simply as:
//┌──────────────┬───────┬───────┐
//│              │ 0     │ 1     │
//├──────────────┼───────┼───────┤
//│   localClock │ 0     │ 5     │
//│        sites │ a     │ b     │
//│       clocks │ 0     │ 0     │
//│      parents │ []    │ []    │
//│    positions │ 0     │ 0     │
//│ deleteCounts │ 0     │ 0     │
//│        items │ hello │ world │
//└──────────────┴───────┴───────┘
import bsearch from "./bsearch";

type Comparator<T, B> = (
	a: T,
	b: B,
	index: number,
	haystack: ArrayLike<T>,
) => number;

export class RleList<T> {
	items: T[] = [];

	push(item: T, tryAppend: (prev: T, cur: T) => boolean) {
		const last = this.last();
		if (!last || !tryAppend(last, item)) this.items.push(item);
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
		return idx ? this.items[idx] : undefined;
	}
}

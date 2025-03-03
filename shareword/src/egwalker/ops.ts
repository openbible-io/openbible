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
//│        sites │ a     │ b     │
//│       clocks │ 0     │ 0     │
//│      parents │ []    │ []    │
//│    positions │ 0     │ 0     │
//│ deleteCounts │ 0     │ 0     │
//│        items │ hello │ world │
//└──────────────┴───────┴───────┘
//
// Items may occupy indices 0-9 OR be concatenated with a custom function.
import bsearch from "./bsearch";
import type { Site, Clock } from "./oplog";

export class Ops<T> {
	/** Allows storing ops in a columnar fashion */
	emptyElement: T;

	sites: Site[] = [];
	clocks: Clock[] = [];
	parents: Clock[][] = [];
	positions: number[] = [];
	deleteCounts: number[] = [];
	items: T[] = [];

	constructor(emptyElement: T) {
		this.emptyElement = emptyElement;
	}

	indexOf(site: Site, clock: Clock): number {
		let idx = bsearch(this.clocks, clock, (a, b) => a - b);
		if (idx < 0) idx = ~idx;
		return idx;
	}

	getSite(clock: Clock): Site {
		return this.#sites[clock];
	}

	getParents(clock: Clock): Clock[] {
		return this.#parents[clock];
	}

	getPosition(clock: Clock): number {
		return this.#positions[clock];
	}

	getDeleteCount(clock: Clock): number {
		return this.#deleteCounts[clock];
	}

	getItem(clock: Clock): T {
		return this.#items[clock];
	}

	push(
		site: Site,
		clock: Clock,
		parents: Clock[],
		pos: number,
		deleteCount: number,
		...items: T[]
	) {
	}
}

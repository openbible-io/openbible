import {
	opMerge,
	opSlice,
	OpType,
	opType,
	type Accumulator,
	type Clock,
	type OpData,
} from "./op";
import { assert } from "./util";
import { Rle } from "./util/rle";

/**
 * Log of `OpData` for a `Site`.
 *
 * Optimized to store runs of insertions or deletions in `AccT`.
 *
 * @param T Single item type.
 * @param AccT Container type for runs.
 */
export class SiteOpLog<T, AccT extends Accumulator<T>> extends Rle<
	OpData<T, AccT>
> {
	constructor() {
		super(
			[],
			(ctx, item) => {
				const prevIdx = ctx.lengthCompressed - 1;
				const prevOp = ctx.items[prevIdx];

				const merged = opMerge(prevOp, item);
				if (merged !== undefined) {
					ctx.items[prevIdx] = merged;
					return true;
				}
				return false;
			},
			opSlice,
		);
	}

	// TODO: remove in favor of runs if possible
	itemAt(siteClock: Clock): T | number {
		const item = this.at(siteClock);
		assert(item !== undefined, `${siteClock} out of bounds`);

		switch (opType(item)) {
			case OpType.Insertion: return (item as AccT)[0];
			case OpType.Deletion: return -1;
		}
		return item as number;
	}
}

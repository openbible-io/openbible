import { MultiArrayList } from "./util/multi-array-list";
import { Rle, type Range } from "./util/rle";

/** A collaborating agent */
export type Site = string;
/**
 * Non-negative integer incremented after each operation.
 * Lamport timestamp.
 */
export type Clock = number;
/** Each UTF-16 code unit is assigned this */
export type Id = { site: Site; clock: Clock };

type RleOp<AccT> = {
	id: Id;
	position: number;
	deleted: boolean;
	items: AccT;
	parents: number[];
};

export interface Accumulator<T> extends ArrayLike<T> {
	slice(start?: number, end?: number): Accumulator<T>;
}

/**
 * Append-only list of `RleOp<T>` optimized to use less memory.
 *
 * @param T Single item type.
 * @param AccT Container type for runs.
 */
export class RleOpLog<T, AccT extends Accumulator<T>> extends Rle<
	RleOp<AccT>,
	MultiArrayList<RleOp<AccT>>
> {
	/**
	* @param emptyItem For runs that are deletions.
	* @param mergeFn How to merge runs together.
	*/
	constructor(
		private emptyItem: AccT,
		mergeFn: (acc: AccT, cur: AccT) => AccT,
	) {
		super(
			new MultiArrayList<RleOp<AccT>>({
				id: { site: "", clock: 0 },
				position: 0,
				deleted: false,
				items: emptyItem,
				parents: [],
			}),
			(items, cur, lastRange) => appendOp(mergeFn, items, cur, lastRange),
		);
	}

	protected getIdRaw(idx: number, offset: number): Id {
		const res = { ...this.items.fields.id[idx] };
		res.clock += offset;
		return res;
	}

	getId(c: Clock): Id {
		const { idx, offset } = this.offsetOf(c);
		return this.getIdRaw(idx, offset);
	}

	protected getPosRaw(idx: number, offset: number, deleted: boolean): number {
		const pos = this.items.fields.position[idx];
		if (deleted) return pos;
		return pos + offset;
	}

	getPos(c: Clock): number {
		const { idx, offset } = this.offsetOf(c);
		return this.getPosRaw(idx, offset, this.getDeleted(c));
	}

	protected getDeletedRaw(idx: number): boolean {
		return this.items.fields.deleted[idx];
	}

	getDeleted(c: Clock): boolean {
		const { idx } = this.offsetOf(c);
		return this.getDeletedRaw(idx);
	}

	protected getItemRaw(idx: number): AccT {
		return this.items.fields.items[idx];
	}

	getItem(c: Clock): T {
		const { idx, offset } = this.offsetOf(c);
		return this.getItemRaw(idx)[offset];
	}

	protected getParentsRaw(idx: number, offset: number): Clock[] {
		const start = this.ranges.fields.start[idx];
		const parents = this.items.fields.parents[idx];
		if (offset) return [start + offset - 1];

		return parents;
	}

	getParents(c: Clock): Clock[] {
		const { idx, offset } = this.offsetOf(c);
		return this.getParentsRaw(idx, offset);
	}

	insertRle(
		id: Id,
		parents: Clock[],
		position: number,
		items: AccT,
	) {
		if (items.length) {
			super.push(
				{ id, parents, position, deleted: false, items },
				items.length,
			);
		}
	}

	deleteRle(
		id: Id,
		parents: Clock[],
		position: number,
		deleteCount: number,
	): void {
		if (deleteCount > 0) {
			super.push(
				{ id, parents, position, deleted: true, items: this.emptyItem },
				deleteCount,
			);
		}
	}

	idToClock(id: Id): Clock {
		const { site, clock } = id;
		const idx = this.items.fields.id.findLastIndex(
			(id, i) =>
				site === id.site &&
				clock >= id.clock &&
				clock <= id.clock + this.ranges.fields.len[i],
		);
		if (idx < 0) {
			throw new Error(`Id (${site},${clock}) does not exist`);
		}

		return (
			this.ranges.fields.start[idx] +
			clock -
			this.items.fields.id[idx].clock
		);
	}
}

function last<T>(arr: T[]) {
	return arr[arr.length - 1];
}

function appendOp<T>(
	mergeFn: (acc: T, cur: T) => T,
	items: MultiArrayList<RleOp<T>>,
	cur: RleOp<T>,
	lastRange?: Range,
): boolean {
	if (!lastRange) return false;

	const { fields } = items;
	const prevDeleted = last(fields.deleted);
	const prevPos = last(fields.position);
	const prevId = last(fields.id);
	const prevLen = lastRange.len;

	if (
		// non-consecutive id?
		prevId.site !== cur.id.site ||
		prevId.clock + prevLen !== cur.id.clock ||
		// non-consecutive parents?
		cur.parents.length !== 1 ||
		lastRange.start + prevLen - 1 !== cur.parents[0]
	)
		return false;

	if (prevDeleted && cur.deleted && prevPos === cur.position) return true;
	if (!prevDeleted && !cur.deleted && prevPos + prevLen === cur.position) {
		items.fields.items[items.fields.items.length - 1] = mergeFn(
			items.fields.items[items.fields.items.length - 1],
			cur.items,
		);
		return true;
	}

	return false;
}

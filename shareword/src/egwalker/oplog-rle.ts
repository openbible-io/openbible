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

type RleOp<ArrT> = {
	id: Id;
	position: number;
	deleted: boolean;
	items: ArrT;
};

/**
 * An oplog optimized to use less memory.
 *
 * @param T The item type.
 * @param ArrT The container to use for runs of items.
 */
export class RleOpLog<T, ArrT extends ArrayLike<T>> {
	// We have a lot of choices of how to encode Ops. Run length is a natural
	// choice because people usually type in runs.
	//
	// Each run requires extra metadata for its range, which we'd like to
	// minimize. We could encode everything as a run, but parents will require
	// new runs whenever there is concurrency. For that reason we separate them
	// out.
	ops: Rle<RleOp<ArrT>, MultiArrayList<RleOp<ArrT>>>;
	opsParents: Rle<Clock[]>;

	constructor(
		public emptyElement: ArrT,
		mergeFn: (acc: ArrT, cur: ArrT) => ArrT,
	) {
		this.ops = new Rle(
			new MultiArrayList<RleOp<ArrT>>({
				id: { site: "", clock: 0 },
				position: 0,
				deleted: false,
				items: emptyElement,
			}),
			(items, cur, lastRange) => appendOp(mergeFn, items, cur, lastRange),
		);
		this.opsParents = new Rle<Clock[]>([], appendOpParents);
	}

	getId(lc: Clock): Id {
		const { idx, offset } = this.ops.offsetOf(lc);
		const res = { ...this.ops.items.fields.id[idx] };
		res.clock += offset;
		return res;
	}

	getPos(lc: Clock): number {
		const { idx, offset } = this.ops.offsetOf(lc);
		const pos = this.ops.items.fields.position[idx];
		if (this.getDeleted(lc)) return pos;
		return pos + offset;
	}

	getDeleted(lc: Clock): boolean {
		const { idx } = this.ops.offsetOf(lc);
		return this.ops.items.fields.deleted[idx];
	}

	getContent(lc: Clock): T {
		const { idx, offset } = this.ops.offsetOf(lc);
		return this.ops.items.fields.items[idx][offset];
	}

	getAllContent(lc: Clock): ArrT {
		const { idx } = this.ops.offsetOf(lc);
		return this.ops.items.fields.items[idx];
	}

	getParents(lc: Clock): Clock[] {
		const { idx, offset } = this.opsParents.offsetOf(lc);
		const start = this.opsParents.ranges.fields.start[idx];
		const parents = this.opsParents.items[idx];
		if (offset) return [start + offset - 1];

		return parents;
	}

	nextClock() {
		return this.ops.length;
	}

	push(
		id: Id,
		parents: Clock[],
		position: number,
		deleteCount: number,
		items: ArrT = this.emptyElement,
	): void {
		if (deleteCount > 0) {
			const nextClock = this.nextClock();
			this.ops.push(
				{ id, position, deleted: true, items: this.emptyElement },
				deleteCount,
			);
			this.opsParents.push(parents, 1);
			this.opsParents.push([nextClock], deleteCount - 1);
		}
		if (items.length) {
			const nextClock = this.nextClock();
			this.ops.push({ id, position, deleted: false, items }, items.length);
			this.opsParents.push(parents, 1);
			this.opsParents.push([nextClock], items.length - 1);
		}
	}

	get length(): number {
		return this.ops.length;
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

	const prevDeleted = last(items.fields.deleted);
	const prevPos = last(items.fields.position);
	const prevId = last(items.fields.id);
	const prevLength = lastRange.len;

	if (prevId.site !== cur.id.site || prevId.clock + prevLength !== cur.id.clock)
		return false;

	if (prevDeleted && cur.deleted && prevPos === cur.position) return true;
	if (!prevDeleted && !cur.deleted && prevPos + prevLength === cur.position) {
		items.fields.items[items.fields.items.length - 1] = mergeFn(
			items.fields.items[items.fields.items.length - 1],
			cur.items,
		);
		return true;
	}

	return false;
}

function appendOpParents(
	_items: Clock[][],
	cur: Clock[],
	lastRange?: Range,
): boolean {
	if (
		lastRange &&
		cur.length === 1 &&
		lastRange.start + lastRange.len - 1 === cur[0]
	)
		return true;

	return false;
}

import { MultiArrayList } from "./util/multi-array-list";
import { Rle, type Range } from "./util/rle";
import type { StateVectorDiff } from "./util/state-vector";

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
	parents: number[];
};

//class Patch<ArrT> {
//	ops: MultiArrayList<{ len: number } & RleOp<ArrT>>;
//	opsParents: MultiArrayList<{ len: number } & { parents: Clock[] }>;
//
//	constructor(public emptyElement: ArrT) {
//		this.ops = new MultiArrayList({
//			len: 0,
//			id: { site: "", clock: 0 },
//			position: 0,
//			deleted: false,
//			items: emptyElement,
//		});
//		this.opsParents = new MultiArrayList({
//			len: 0,
//			parents: [],
//		});
//	}
//};

/**
 * An oplog optimized to use less memory. Run length is a natural choice
 * because list edits usually occur in runs.
 *
 * @param T The item type.
 * @param ArrT The container to use for runs of items.
 */
export class RleOpLog<T, ArrT extends ArrayLike<T>> {
	// We have a lot of choices of how to encode Ops.
	//
	ops: Rle<RleOp<ArrT>, MultiArrayList<RleOp<ArrT>>>;

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
				parents: [],
			}),
			(items, cur, lastRange) => appendOp(mergeFn, items, cur, lastRange),
		);
	}

	getIdRaw(idx: number, offset: number): Id {
		const res = { ...this.ops.items.fields.id[idx] };
		res.clock += offset;
		return res;
	}

	getId(lc: Clock): Id {
		const { idx, offset } = this.ops.offsetOf(lc);
		return this.getIdRaw(idx, offset);
	}

	getPosRaw(idx: number, offset: number, deleted: boolean): number {
		const pos = this.ops.items.fields.position[idx];
		if (deleted) return pos;
		return pos + offset;
	}

	getPos(lc: Clock): number {
		const { idx, offset } = this.ops.offsetOf(lc);
		return this.getPosRaw(idx, offset, this.getDeleted(lc));
	}

	getDeletedRaw(idx: number): boolean {
		return this.ops.items.fields.deleted[idx];
	}

	getDeleted(lc: Clock): boolean {
		const { idx } = this.ops.offsetOf(lc);
		return this.getDeletedRaw(idx);
	}

	getContentRaw(idx: number): ArrT {
		return this.ops.items.fields.items[idx];
	}

	getContent(lc: Clock): T {
		const { idx, offset } = this.ops.offsetOf(lc);
		return this.getContentRaw(idx)[offset];
	}

	getParentsRaw(idx: number, offset: number): Clock[] {
		const start = this.ops.ranges.fields.start[idx];
		const parents = this.ops.items.fields.parents[idx];
		if (offset) return [start + offset - 1];

		return parents;
	}

	getParents(lc: Clock): Clock[] {
		const { idx, offset } = this.ops.offsetOf(lc);
		return this.getParentsRaw(idx, offset);
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
			this.ops.push(
				{ id, parents, position, deleted: true, items: this.emptyElement },
				deleteCount,
			);
		}
		if (items.length) {
			this.ops.push(
				{ id, parents, position, deleted: false, items },
				items.length,
			);
		}
	}

	get length(): number {
		return this.ops.length;
	}

	idToClock(id: Id): Clock {
		const { site, clock } = id;
		const idx = this.ops.items.fields.id.findLastIndex(
			(id, i) =>
				site === id.site &&
				clock >= id.clock &&
				clock <= id.clock + this.ops.ranges.fields.len[i],
		);
		if (idx < 0) {
			throw new Error(`Id (${site},${clock}) does not exist`);
		}

		return (
			this.ops.ranges.fields.start[idx] +
			clock -
			this.ops.items.fields.id[idx].clock
		);
	}

	//patch(svd: StateVectorDiff): Patch<ArrT> {
	//	const res = new Patch(this.emptyElement);
	//
	//	// Find start of iteration.
	//	// TODO: make cheaper by having oplog store { site: { clock, lc } }
	//	const startClock = Object.entries(svd)
	//		.map(([site, clock]) => this.idToClock({ site, clock }))
	//		.reduce((acc, cur) => Math.min(acc, cur), 0);
	//	const { idx: startIdx } = this.ops.offsetOf(startClock);
	//
	//	// Push all the relevant ops.
	//	const { items } = this.ops;
	//	const { fields } = items;
	//	for (let i = startIdx; i < items.length; i++) {
	//		const id = fields.id[i];
	//		const opLen = this.ops.ranges.fields.len[i];
	//		const opEnd = id.clock + opLen;
	//		const needFrom = svd[id.site];
	//		if (!needFrom || needFrom <= opEnd) continue;
	//
	//		//const offset = opEnd - needFrom;
	//
	//		res.ops.push({
	//			len: opLen,
	//			id,
	//			position: fields.position[i],
	//			deleted: fields.deleted[i],
	//			items: fields.items[i],
	//		});
	//	}
	//
	//	return res;
	//}
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

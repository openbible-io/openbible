import { opSlice, opType, OpType, type OpData } from "./op";
import { MultiArrayList, ListMap, Rle, assert } from "./util";

/** A collaborating agent */
export type Site = string;
/**
 * Non-negative integer incremented after each operation.
 * Lamport timestamp.
 */
export type Clock = number;

type RleOp<T, AccT extends Accumulator<T>> = {
	site: number;
	clock: number;
	position: number;
	data: OpData<T, AccT>;
};

export interface Accumulator<T> extends ArrayLike<T> {
	slice(start?: number, end?: number): this;
	[Symbol.iterator](): Iterator<T>;
}

/**
 * Append-only list of `RleOp<T>` optimized to use less memory.
 *
 * @param T Single item type.
 * @param AccT Container type for runs.
 */
export class RleOpLog<T, AccT extends Accumulator<T>> extends Rle<
	RleOp<T, AccT>,
	MultiArrayList<RleOp<T, AccT>>
> {
	sites = new ListMap<Site>();
	parents: Record<Clock, number[]> = {};

	/**
	 * @param emptyItem For runs that are deletions.
	 * @param mergeFn How to merge runs together.
	 */
	constructor(
		public mergeFn: (acc: AccT, cur: AccT) => AccT,
	) {
		super(
			new MultiArrayList<RleOp<T, AccT>>({
				site: 0,
				clock: 0,
				position: 0,
				data: 0,
			}),
			(ctx, item, len) => {
				const { fields } = ctx.items;
				const prevIdx = ctx.starts.length - 1;
				const prevLen = ctx.len(prevIdx);
				const prevDeleted = opType(fields.data[prevIdx]) === OpType.Deletion;
				const curDeleted = opType(item.data) === OpType.Deletion;

				const prevPos = fields.position[prevIdx];
				const prevSite = fields.site[prevIdx];
				const prevClock = fields.clock[prevIdx];

				// non-consecutive id?
				if (prevSite !== item.site || prevClock + prevLen !== item.clock)
					return false;

				// deletion?
				if (prevDeleted && curDeleted && prevPos === item.position) {
					(fields.data[prevIdx] as number) -= len;
					return true;
				}
				// insertion?
				if (
					!prevDeleted &&
					!curDeleted &&
					prevPos + prevLen === item.position
				) {
					fields.data[prevIdx] = mergeFn(
						fields.data[prevIdx] as AccT,
						item.data as AccT,
					);
					return true;
				}

				return false;
			},
			(item, start, end) => ({
				site: item.site,
				clock: item.clock + (start ?? 0),
				position:
					item.position + (opType(item) === OpType.Deletion ? 0 : (start ?? 0)),
				data: opSlice(item.data, start, end),
			}),
		);
	}

	getSiteRaw(idx: number): Site {
		const site = this.items.fields.site[idx];
		return this.sites.keys[site];
	}

	getSite(c: Clock): Site {
		const { idx } = this.offsetOf(c);
		return this.getSiteRaw(idx);
	}

	getClockRaw(idx: number, offset: number): Clock {
		let res = this.items.fields.clock[idx];
		res += offset;
		return res;
	}

	getClock(c: Clock): Clock {
		const { idx, offset } = this.offsetOf(c);
		return this.getClockRaw(idx, offset);
	}

	getPosRaw(idx: number, offset: number, deleted: boolean): number {
		const pos = this.items.fields.position[idx];
		if (deleted) return pos;
		return pos + offset;
	}

	getPos(c: Clock): number {
		const { idx, offset } = this.offsetOf(c);
		return this.getPosRaw(idx, offset, this.getDeleted(c));
	}

	getDeletedRaw(idx: number): boolean {
		return opType(this.getItemRaw(idx)) === OpType.Deletion;
	}

	getDeleted(c: Clock): boolean {
		const { idx } = this.offsetOf(c);
		return this.getDeletedRaw(idx);
	}

	getItemRaw(idx: number): OpData<T, AccT> {
		return this.items.fields.data[idx];
	}

	getItem(c: Clock): T {
		const { idx, offset } = this.offsetOf(c);
		const item = this.getItemRaw(idx);
		assert(opType(item) === OpType.Insertion, "get rid of this");
		return (item as AccT)[offset];
	}

	getData(c: Clock): T | number {
		const { idx, offset } = this.offsetOf(c);
		const data = this.getItemRaw(idx);
		switch (opType(data)) {
			case OpType.Insertion:
				return (data as AccT)[offset];
			case OpType.Deletion:
				return -1;
			default:
				return data as number;
		}
	}

	getParents(c: Clock): Clock[] {
		if (c >= this.length) throw new Error(`${c} out of bounds`);
		return this.parents[c] ?? [c - 1];
	}

	insertParents(parents: Clock[]): void {
		const prevIdx = this.starts.length - 1;
		// non-consecutive parents?
		if (
			!prevIdx ||
			parents.length !== 1 ||
			parents[0] !== this.starts[prevIdx] + this.len(prevIdx) - 1
		) {
			this.parents[this.length] = parents;
		}
	}

	insertRle(
		site: Site,
		clock: Clock,
		parents: Clock[],
		position: number,
		items: AccT,
	): void {
		if (!items.length) return;

		this.insertParents(parents);
		super.push(
			{ site: this.sites.getOrPut(site), clock, position, data: items },
			items.length,
		);
	}

	deleteRle(
		site: Site,
		clock: Clock,
		parents: Clock[],
		position: number,
		deleteCount: number,
	): void {
		if (deleteCount <= 0) return;
		this.insertParents(parents);
		super.push(
			{
				site: this.sites.getOrPut(site),
				clock,
				position,
				data: -deleteCount,
			},
			deleteCount,
		);
	}
}

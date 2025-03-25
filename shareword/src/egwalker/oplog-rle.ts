import ListMap from "./util/list-map";
import { MultiArrayList } from "./util/multi-array-list";
import { Rle } from "./util/rle";

/** A collaborating agent */
export type Site = string;
/**
 * Non-negative integer incremented after each operation.
 * Lamport timestamp.
 */
export type Clock = number;

type RleOp<AccT> = {
	site: number;
	clock: number;
	position: number;
	items: AccT;
};

export interface Accumulator<T> extends ArrayLike<T> {
	slice(start?: number, end?: number): Accumulator<T>;
	[Symbol.iterator](): Iterator<T>;
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
	sites = new ListMap<Site>();
	parents: Record<Clock, number[]> = {};

	/**
	 * @param emptyItem For runs that are deletions.
	 * @param mergeFn How to merge runs together.
	 */
	constructor(
		protected emptyItem: AccT,
		mergeFn: (acc: AccT, cur: AccT) => AccT,
	) {
		super(
			new MultiArrayList<RleOp<AccT>>({
				site: 0,
				clock: 0,
				position: 0,
				items: emptyItem,
			}),
			(ctx, item, len) => appendOp(mergeFn, ctx, item, len),
		);
	}

	protected getSiteRaw(idx: number): Site {
		const site = this.items.fields.site[idx];
		return this.sites.keys[site];
	}

	getSite(c: Clock): Site {
		const { idx } = this.offsetOf(c);
		return this.getSiteRaw(idx);
	}

	protected getClockRaw(idx: number, offset: number): Clock {
		let res = this.items.fields.clock[idx];
		res += offset;
		return res;
	}

	getClock(c: Clock): Clock {
		const { idx, offset } = this.offsetOf(c);
		return this.getClockRaw(idx, offset);
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
		return this.ranges.fields.len[idx] < 0;
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

	getParents(c: Clock): Clock[] {
		if (c >= this.length) throw new Error(`${c} out of bounds`);
		return this.parents[c] ?? [c - 1];
	}

	protected insertParents(parents: Clock[]): void {
		const prevStart = this.ranges.fields.start.at(-1) ?? -2;
		const prevLen = this.len(this.ranges.length - 1);
		// non-consecutive parents?
		if (parents.length !== 1 || prevStart + prevLen - 1 !== parents[0]) {
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
			{ site: this.sites.getOrPut(site), clock, position, items },
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
				items: this.emptyItem,
			},
			-deleteCount,
		);
	}
}

function appendOp<AccT>(
	mergeFn: (acc: AccT, cur: AccT) => AccT,
	ctx: Rle<RleOp<AccT>, MultiArrayList<RleOp<AccT>>>,
	item: RleOp<AccT>,
	len: number,
): boolean {
	const { fields } = ctx.items;
	// biome-ignore lint/style/noNonNullAssertion: only called after first push
	let prevLen = ctx.ranges.fields.len.at(-1)!;
	const prevDeleted = prevLen < 0;
	prevLen = ctx.len(ctx.ranges.length - 1);
	const curDeleted = len < 0;

	// biome-ignore lint/style/noNonNullAssertion: only called after first push
	const prevPos = fields.position.at(-1)!;
	// biome-ignore lint/style/noNonNullAssertion: only called after first push
	const prevSite = fields.site.at(-1)!;
	// biome-ignore lint/style/noNonNullAssertion: only called after first push
	const prevClock = fields.clock.at(-1)!;

	// non-consecutive id?
	if (prevSite !== item.site || prevClock + prevLen !== item.clock)
		return false;

	// deletion?
	if (prevDeleted && curDeleted && prevPos === item.position) return true;
	// insertion?
	if (!prevDeleted && !curDeleted && prevPos + prevLen === item.position) {
		const { items } = ctx.items.fields;
		items[items.length - 1] = mergeFn(items[items.length - 1], item.items);
		return true;
	}

	return false;
}

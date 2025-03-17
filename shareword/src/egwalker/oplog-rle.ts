import { MultiArrayList } from "./util/multi-array-list";
import { Rle, type Range } from "./util/rle";

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
	/** Append-only unique list. */
	sites: string[] = [];
	/** For fast pushing. */
	siteMap: Record<Site, number> = {};

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
				site: 0,
				clock: 0,
				position: 0,
				deleted: false,
				items: emptyItem,
				parents: [],
			}),
			(items, cur, lastRange) => appendOp(mergeFn, items, cur, lastRange),
		);
	}

	protected getSiteRaw(idx: number): Site {
		const site = this.items.fields.site[idx];
		return this.sites[site];
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

	protected getOrPutSite(site: Site): number {
		if (!(site in this.siteMap)) {
			this.siteMap[site] = this.sites.length;
			this.sites.push(site);
		}

		return this.siteMap[site];
	}

	insertRle(
		site: Site,
		clock: Clock,
		parents: Clock[],
		position: number,
		items: AccT,
	): boolean {
		if (!items.length) return false;
		const siteIndex = this.getOrPutSite(site);

		return super.push(
			{ site: siteIndex, clock, parents, position, deleted: false, items },
			items.length,
		);
	}

	deleteRle(
		site: Site,
		clock: Clock,
		parents: Clock[],
		position: number,
		deleteCount: number,
	): boolean {
		if (deleteCount <= 0) return false;
		const siteIndex = this.getOrPutSite(site);

		return super.push(
			{ site: siteIndex, clock, parents, position, deleted: true, items: this.emptyItem },
			deleteCount,
		);
	}

	// TODO: optimize
	protected idToIndex(site: Site, clock: Clock): number {
		for (let i = this.items.length - 1; i >= 0; i--) {
			const site2 = this.getSiteRaw(i);
			const clock2 = this.getClockRaw(i, 0);
			if (
				site === site2 &&
				clock >= clock2 &&
				clock <= clock2 + this.ranges.fields.len[i]
			) return i;
		}
		throw new Error(`Id (${site},${clock}) does not exist`);
	}

	idToClock(site: Site, clock: Clock): Clock {
		const idx = this.idToIndex(site, clock);

		return (
			this.ranges.fields.start[idx] +
			clock -
			this.getClockRaw(idx, 0)
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
	const prevSite = last(fields.site);
	const prevClock = last(fields.clock);
	const prevLen = lastRange.len;

	if (
		// non-consecutive id?
		prevSite !== cur.site ||
		prevClock + prevLen !== cur.clock ||
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

import { opLength, type Accumulator, type Clock, type Op, type OpData, type OpId, type OpRun, type Site } from "./op";
import { SiteOpLog } from "./oplog-site";
//import { Patch } from "./patch";
import { assert, MultiArrayList, Rle } from "./util";

/** Max stored `clock` for each site. Useful for diffing. */
export type StateVector = Record<Site, Clock>;

// For O(1) lookups instead of O(log n).
// Pays penalty of O(n) slice.
class MapContainer<V> {
	map: { [k: number]: V } = {};
	length = 0;

	at(i: number): V {
		return this.map[i];
	}

	push(item: V): void {
		this.map[this.length++] = item;
	}

	slice(start = 0, end = this.length): MapContainer<V> {
		const res = new MapContainer<V>();
		for (let i = start; i < end; i++) {
			const item = this.map[i];
			if (item) res.push(item);
		}
		return res;
	}
}

export class OpLog<T, AccT extends Accumulator<T> = T[]> {
	/** Per-site `OpData<T, AccT>`. */
	siteLogs: { [site: Site]: SiteOpLog<T, AccT> } = {};
	/** Order that ops were pushed to `siteLogs`. */
	order = new Rle<OpId, MultiArrayList<OpId>>(
		new MultiArrayList<OpId>({
			site: "",
			siteClock: 0,
		}),
		(ctx, item) =>
			ctx.items.fields.site[ctx.lengthCompressed - 1] === item.site,
		(opId, start, end) => ({
			site: opId.site,
			siteClock: opId.siteClock + (start ?? 0) - (end ?? 0),
		}),
	);
	/** Indices into `order`. Use a map for fast lookup. */
	parents = new Rle<Clock[], MapContainer<Clock[]>>(
		new MapContainer(),
		(ctx, item) => item.length === 1 && item[0] === ctx.length - 1,
		() => [],
	);
	/** Next Op's `parents`. */
	frontier: Clock[] = [];

	constructor(public site: Site) {}

	get length() {
		return this.order.length;
	}

	get lengthCompressed() {
		return this.order.lengthCompressed;
	}

	#nextClock(site: Site): Clock {
		return this.siteLogs[site]?.length ?? 0;
	}

	#push(data: OpData<T, AccT>, site: Site = this.site): void {
		this.siteLogs[site] ??= new SiteOpLog<T, AccT>();
		const log = this.siteLogs[site];
		const len = opLength(data);

		log.push(data, len);
		this.order.push({ site, siteClock: log.length - len }, len);
		this.parents.push(this.frontier);
		this.frontier = [log.length - 1];
	}

	insert(items: AccT): void {
		if (!items.length) return;

		this.#push(items);
	}

	delete(deleteCount = 1): void {
		if (deleteCount <= 0) return;

		this.#push(-deleteCount);
	}

	seek(pos: number): void {
		if (pos < 0 || pos >= this.#nextClock(this.site)) return;

		this.#push(pos);
	}

	parentsAt(clock: Clock): Clock[] {
		return this.parents.items.map[clock] ?? [clock - 1];
	}

	*runs(
		start = 0,
		end = this.length,
	): Generator<{ idx: number; len: number; item: OpRun<T, AccT> }> {
		assert(end >= start, "backwards slice");

		//let visitedIdxs: StateVector = {};
		let clock = 0;

		for (const run0 of this.order.runs()) {
			const { site, siteClock } = run0.item;
			for (const run1 of this.siteLogs[site].runs(siteClock, siteClock + run0.len)) {
				yield { idx: clock, len: run1.len, item: {
					site,
					siteClock,
					data: run1.item,
					parents: this.parentsAt(clock),
				}};
				clock += run1.len;
			}
		}
	}

	/** TODO: remove this in favor of runs if possible */
	at(clock: Clock): Op<T> {
		const { idx, offset } = this.order.offsetOf(clock);
		const { fields } = this.order.items;
		const site = fields.site[idx];
		const siteClock = fields.siteClock[idx] + offset;
		const log = this.siteLogs[site];
		assert(log, `missing site ${site}`);

		return {
			site,
			siteClock,
			data: log.itemAt(siteClock),
			parents: this.parentsAt(clock),
		};
	}

	/** Give this to another oplog to create a minimal patch. */
	stateVector(): StateVector {
		const res: StateVector = {};
		for (const site in this.siteLogs)
			res[site] = this.siteLogs[site].length - 1;
		return res;
	}

	//#idToIdx(site: Site, siteClock: Clock): number {
	//	const idx = this.#idToSiteIdx(site, siteClock);
	//	const res = this.siteIdxs[site][idx];
	//	if (res === undefined) {
	//		debugPrint(this);
	//		throw new Error(`Id (${site},${siteClock}) does not exist`);
	//	}
	//	const start = this.getSiteClockRaw(res, 0);
	//	const end = start + this.ops.len(res);
	//	if (site !== this.getSiteRaw(res) || siteClock < start || siteClock > end) {
	//		debugPrint(this);
	//		throw new Error(`Id (${site},${siteClock}) does not exist`);
	//	}
	//
	//	return res;
	//}

	//diff(to: StateVector): Patch<T, AccT> {
	//	const res = new Patch<T, AccT>();
	//
	//	for (const site in this.siteLogs) {
	//		const startClock = to[site] ?? 0;
	//		res.siteLogs[site] = {
	//			log: this.siteLogs[site],
	//			parents: new Rle(
	//				() => false,
	//				new MultiArrayList<OpId>({
	//					site: "",
	//					siteClock: 0,
	//				}),
	//			),
	//		};
	//	}
	//
	//	return res;
	//}

	//apply(patch: Patch<T, AccT>): void {
	//	const toClock = (site: Site, clock: Clock): Clock => {
	//		const idx = this.#idToIdx(site, clock);
	//		return this.ops.startIdxs[idx] - this.getSiteClockRaw(idx, -clock);
	//	};
	//
	//	for (const op of patch.iterator()) {
	//		const offset = 0;
	//		const filter = offset < 0;
	//
	//		if (filter) continue;
	//		offsetOp(op, offset);
	//
	//		// push op first in case it has a parent which references it
	//		this.ops.push({
	//			siteIdx: this.sites.getOrPut(op.site),
	//			siteClock: op.siteClock,
	//			pos: op.pos,
	//			data: op.data,
	//		});
	//		this.#advanceClock(op.site);
	//
	//		for (const parents of op.parents()) {
	//			const remapped: Clock[] = [];
	//			for (let j = 0; j < parents.parents.length; j += 2) {
	//				const site: Site = patch.sites[parents.parents[j]];
	//				const siteClock: Clock = parents.parents[j + 1];
	//				remapped.push(toClock(site, siteClock));
	//			}
	//			remapped.sort((a, b) => a - b);
	//			this.pushParents(remapped, this.length - op.len);
	//			console.log(
	//				this.frontier,
	//				remapped,
	//				this.length - op.len,
	//				parents.offset,
	//			);
	//			this.frontier = advanceFrontier(
	//				this.frontier,
	//				remapped,
	//				this.length - op.len + parents.offset,
	//			);
	//			const clocks = patch.parents.fields.clock;
	//			const nextClock = clocks[parents.idx + 1];
	//			if (nextClock) {
	//				this.frontier[this.frontier.length - 1] +=
	//					nextClock - clocks[parents.idx];
	//			}
	//		}
	//		this.frontier[this.frontier.length - 1] = this.length - 1;
	//	}
	//}
	//
	//merge(src: OpLog<T, AccT>) {
	//	this.apply(src.diff(this.stateVector()));
	//}
}

export function advanceFrontier(
	frontier: Clock[],
	parents: Clock[],
	clock: Clock,
): Clock[] {
	const res = frontier.filter((c) => !parents.includes(c));
	res.push(clock);
	return res.sort((a, b) => a - b);
}

export function debugPrint<T, AccT extends Accumulator<T>>(
	oplog: OpLog<T, AccT>,
	full = false,
) {
	if (full) {
		type OpItem = {
			id: string;
			data: T | number;
			parents: Clock[];
		};
		const ops: OpItem[] = [];
		for (let i = 0; i < oplog.length; i++) {
			const op = oplog.at(i);
			ops.push({
				id: `${op.site},${op.siteClock}`,
				data: op.data,
				parents: op.parents,
			});
		}
		console.table(ops);
	} else {
		type Op = {
			clock: Clock;
			id: string;
			data: OpData<T, AccT>;
			parents: Clock[];
		};
		const ops: Op[] = [];
		for (const { idx, item } of oplog.runs()) {
			ops.push({
				clock: idx,
				id: `${item.site},${item.siteClock}`,
				data: item.data,
				parents: item.parents,
			});
		}
		console.table(ops);
	}
}

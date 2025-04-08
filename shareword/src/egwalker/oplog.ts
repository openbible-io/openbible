import type { OpData } from "./op";
import { RleOpLog } from "./oplog-rle";
import type { Accumulator, Clock, Site } from "./oplog-rle";
import { Patch, type StateVector } from "./patch";
import { binarySearch } from "./util";

/** An append-only list of immutable operations */
export class OpLog<T, AccT extends Accumulator<T> = T[]> extends RleOpLog<
	T,
	AccT
> {
	/** Next Op's `parents`. */
	frontier: Clock[] = [];
	/** Indices into `this.items`. */
	siteIdxs: Record<Site, number[]> = {};

	#nextClock(site: Site): Clock {
		const idxs = this.siteIdxs[site];
		if (idxs?.length) {
			const last = idxs[idxs.length - 1];
			return this.items.fields.clock[last] + this.len(last);
		}
		return 0;
	}

	advanceClock(site: Site): void {
		this.siteIdxs[site] ??= [];
		const idxs = this.siteIdxs[site]; 
		if (idxs.at(-1) !== this.items.length - 1) {
			idxs.push(this.items.length - 1);
		}
	}

	insert(site: Site, pos: number, items: AccT) {
		this.insertRle(
			site,
			this.#nextClock(site),
			this.frontier,
			pos,
			items,
		);
		this.advanceClock(site);
		this.frontier = [this.length - 1];
	}

	delete(site: Site, pos: number, delCount = 1) {
		this.deleteRle(
			site,
			this.#nextClock(site),
			this.frontier,
			pos,
			delCount,
		);
		this.advanceClock(site);
		this.frontier = [this.length - 1];
	}

	idToIndex(site: Site, clock: Clock): number {
		const idx = binarySearch(
			this.siteIdxs[site],
			clock,
			(idx, needle) => {
				const start = this.items.fields.clock[idx];
				if (start > needle) return 1;
				const len = this.len(idx);
				if (start + len <= needle) return -1;
				return 0;
			},
			0,
		);
		const res = this.siteIdxs[site][idx];
		const start = this.items.fields.clock[res];
		const end = start + this.len(res);
		if (site !== this.getSiteRaw(res) || clock < start || clock > end) {
			debugPrint(this);
			console.log(this.getSiteRaw(res), this.siteIdxs, idx, res, start, end);
			throw new Error(`Id (${site},${clock}) does not exist`);
		}

		return res;
	}

	stateVector(): StateVector {
		const res: StateVector = {};
		for (const [site, idxs] of Object.entries(this.siteIdxs)) {
			// biome-ignore lint/style/noNonNullAssertion: idxs.length > 0
			const idx = idxs.at(-1)!;
			res[site] = this.items.fields.clock[idx] + this.len(idx) - 1;
		}
		return res;
	}

	merge(src: OpLog<T, AccT>) {
		new Patch(this.emptyItem, src, this.stateVector()).apply(this);
	}
}

export function advanceFrontier(
	frontier: Clock[],
	clock: Clock,
	parents: Clock[],
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
		type Op = {
			position: number;
			deleted: boolean;
			item: T | string;
			site: Site;
			clock: Clock;
			parents: Clock[];
		};
		const ops: Op[] = [];
		for (let i = 0; i < oplog.length; i++) {
			ops.push({
				position: oplog.getPos(i),
				deleted: oplog.getDeleted(i),
				item: oplog.getItem(i) ?? "",
				site: oplog.getSite(i),
				clock: oplog.getClock(i),
				parents: oplog.getParents(i),
			});
		}
		console.table(ops);
	} else {
		type Op = {
			start: number;
			position: number;
			data: OpData<T, AccT>;
			site: Site;
			clock: Clock;
			parents: Record<number, number[]>;
		};
		const ops: Op[] = [];
		const { fields } = oplog.items;
		for (let i = 0; i < oplog.items.length; i++) {
			const start = oplog.starts[i];
			const parents: Record<number, number[]> = {};
			const len = oplog.len(i);
			for (let j = 0; j < len; j++) {
				const opParents = oplog.parents[start + j];
				if (opParents) parents[start + j] = opParents;
			}
			ops.push({
				start,
				position: fields.position[i],
				data: fields.data[i],
				site: oplog.sites.keys[fields.site[i]],
				clock: fields.clock[i],
				parents,
			});
		}
		console.table(ops);
	}
}

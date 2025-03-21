import { RleOpLog } from "./oplog-rle";
import type { Accumulator, Clock, Site } from "./oplog-rle";
import PriorityQueue from "./pq";
import { MultiArrayList } from "./util/multi-array-list";
import ListMap from "./util/list-map";

type StateVector = Record<Site, number>;

type PatchParents = Record<number, [site: number, clock: Clock][]>;
export class Patch<AccT> {
	ops: MultiArrayList<{
		site: number;
		clock: Clock;
		position: number;
		items: AccT;
		len: number;
		parents: PatchParents;
	}>;
	sites: Site[] = [];

	constructor(emptyItem: AccT) {
		this.ops = new MultiArrayList({
			site: 0,
			clock: 0,
			position: 0,
			items: emptyItem,
			len: 0,
			parents: {},
		});
	}
}

/** An append-only list of immutable operations */
export class OpLog<T, AccT extends Accumulator<T> = T[]> extends RleOpLog<
	T,
	AccT
> {
	/** Next Op's `parents`. */
	frontier: Clock[] = [];
	/** Indices into `this.fields` for each site. */
	stateVector: StateVector = {};

	#nextClock(site: Site): Clock {
		return (this.stateVector[site] ?? -1) + 1;
	}

	insert(site: Site, pos: number, items: AccT) {
		const clock = this.#nextClock(site);

		this.insertRle(site, clock, this.frontier, pos, items);
		this.frontier = [this.length - 1];
		this.stateVector[site] = clock + items.length - 1;
	}

	delete(site: Site, pos: number, delCount = 1) {
		const clock = this.#nextClock(site);

		this.deleteRle(site, clock, this.frontier, pos, delCount);
		this.frontier = [this.length - 1];
		this.stateVector[site] = clock + delCount - 1;
	}

	diff(to: StateVector): Patch<AccT> {
		const res = new Patch<AccT>(this.emptyItem);
		const sites = new ListMap<Site>();

		// 1. State vector diff
		const missing: Record<Site, Clock> = {};
		// This optimization is good enough because the missing items
		// are usually continuous.
		let minI = Number.POSITIVE_INFINITY;
		for (const [site, maxClock] of Object.entries(this.stateVector)) {
			if (site in to) {
				if (maxClock > to[site]) {
					missing[site] = to[site] + 1;
					minI = Math.min(minI, this.idToIndex(site, to[site] + 1));
				}
			} else {
				// missing everything
				missing[site] = 0;
				minI = Math.min(minI, this.idToIndex(site, 0));
			}
		}

		// 2. Scan RLE items
		let lastParent = -2;
		for (let i = minI; i < this.items.length; i++) {
			const site = this.getSiteRaw(i);
			const clock = this.getClockRaw(i, 0);
			const len = this.len(i);
			if (!(site in missing) || clock + len <= missing[site]) continue;

			const offset = clock < missing[site] ? missing[site] - clock : 0;
			const start = this.ranges.fields.start[i];
			const deleted = this.getDeletedRaw(i);
			const parents: PatchParents = {};
			for (let j = offset; j < len; j++) {
				const thisParents =
					j === offset && lastParent + 1 !== i + j
						? this.getParents(start + j) // might not be in other oplog's run
						: this.parents[start + j];
				if (thisParents) {
					parents[j - offset] = thisParents.map((p) => {
						const { idx, offset } = this.offsetOf(p);
						const site = sites.getOrPut(this.getSiteRaw(idx));
						const clock = this.getClockRaw(idx, offset);

						return [site, clock];
					});
					lastParent = i + j;
				}
			}

			res.ops.push({
				site: sites.getOrPut(site),
				clock: this.getClockRaw(i, offset),
				position: this.getPosRaw(i, offset, deleted),
				// @ts-ignore idc if diff subtype as long as fulfills interface
				items: this.getItemRaw(i).slice(offset),
				len: (len - offset) * (deleted ? -1 : 1),
				parents,
			});
		}

		res.sites = sites.keys;
		return res;
	}

	apply(patch: Patch<AccT>): void {
		const toClock = (site: Site, clock: Clock): Clock => {
			const idx = this.idToIndex(site, clock);
			return this.ranges.fields.start[idx] - this.getClockRaw(idx, -clock);
		};

		const { fields } = patch.ops;
		for (let i = 0; i < patch.ops.length; i++) {
			const site = patch.sites[fields.site[i]];
			const clock = fields.clock[i];
			const len = Math.abs(fields.len[i]);

			this.push(
				{
					site: this.sites.getOrPut(site),
					clock,
					position: fields.position[i],
					items: fields.items[i],
				},
				fields.len[i],
			);
			for (const [j, parents] of Object.entries(fields.parents[i])) {
				this.parents[this.length - len + +j] = parents
					.map((id) => toClock(patch.sites[id[0]], id[1]))
					.sort((a, b) => a - b);
			}
			for (let j = 0; j < len; j++) {
				const nextClock = this.length - len + j;
				this.frontier = advanceFrontier(
					this.frontier,
					nextClock,
					this.getParents(nextClock),
				);
			}
			this.stateVector[site] = clock + len - 1;
		}
	}

	merge(src: OpLog<T, AccT>) {
		this.apply(src.diff(this.stateVector));
	}

	diffBetween(a: Clock[], b: Clock[]): { aOnly: Clock[]; bOnly: Clock[] } {
		type DiffFlag = "a" | "b" | "both";
		const flags: { [clock: Clock]: DiffFlag } = {};
		const queue = new PriorityQueue<Clock>((a, b) => b - a);
		let numShared = 0;

		function enq(v: Clock, flag: DiffFlag) {
			const oldFlag = flags[v];
			if (oldFlag == null) {
				queue.push(v);
				flags[v] = flag;
				if (flag === "both") numShared++;
			} else if (flag !== oldFlag && oldFlag !== "both") {
				flags[v] = "both";
				numShared++;
			}
		}

		for (const aa of a) enq(aa, "a");
		for (const bb of b) enq(bb, "b");

		const aOnly: Clock[] = [];
		const bOnly: Clock[] = [];

		while (queue.size() > numShared) {
			// biome-ignore lint/style/noNonNullAssertion: size check above
			const clock = queue.pop()!;
			const flag = flags[clock];

			if (flag === "a") aOnly.push(clock);
			else if (flag === "b") bOnly.push(clock);
			else numShared--;

			for (const p of this.getParents(clock)) enq(p, flag);
		}

		return { aOnly, bOnly };
	}

	diffBetween2(
		a: Clock[],
		b: Clock[],
	): {
		head: Clock[];
		shared: Clock[];
		bOnly: Clock[];
	} {
		type MergePoint = {
			clocks: Clock[];
			inA: boolean;
		};

		const queue = new PriorityQueue<MergePoint>((a, b) =>
			cmpClocks(b.clocks, a.clocks),
		);

		const enq = (localClocks: Clock[], inA: boolean) => {
			queue.push({
				clocks: localClocks.toSorted((a, b) => b - a),
				inA,
			});
		};

		enq(a, true);
		enq(b, false);

		let head: Clock[] = [];
		const shared = [];
		const bOnly = [];

		let next: MergePoint | undefined;
		while ((next = queue.pop())) {
			if (next.clocks.length === 0) break; // root element
			let inA = next.inA;

			let peek: MergePoint | undefined;
			// multiple elements may have same merge point
			while ((peek = queue.peek())) {
				if (cmpClocks(next.clocks, peek.clocks)) break;

				queue.pop();
				if (peek.inA) inA = true;
			}

			if (queue.isEmpty()) {
				head = next.clocks.reverse();
				break;
			}

			if (next.clocks.length >= 2) {
				for (const lc of next.clocks) enq([lc], inA);
			} else {
				const lc = next.clocks[0];
				//assert(next.clocks.length == 1);
				if (inA) shared.push(lc);
				else bOnly.push(lc);

				enq(this.getParents(lc), inA);
			}
		}

		return {
			head,
			shared: shared.reverse(),
			bOnly: bOnly.reverse(),
		};
	}
}

function cmpClocks(a: Clock[], b: Clock[]): number {
	for (let i = 0; i < a.length; i++) {
		if (b.length <= i) return 1;

		const delta = a[i] - b[i];
		if (delta !== 0) return delta;
	}

	if (a.length < b.length) return -1;
	return 0;
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
			len: number;
			position: number;
			item: AccT;
			site: Site;
			clock: Clock;
		};
		const ops: Op[] = [];
		const { fields } = oplog.items;
		const rangeFields = oplog.ranges.fields;
		for (let i = 0; i < oplog.items.length; i++) {
			const start = rangeFields.start[i];
			ops.push({
				start,
				len: rangeFields.len[i],
				position: fields.position[i],
				item: fields.items[i],
				site: oplog.sites.keys[fields.site[i]],
				clock: fields.clock[i],
			});
		}
		console.table(ops);
		console.log("parents", oplog.parents);
	}
}

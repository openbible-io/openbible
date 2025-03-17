import { RleOpLog, type Accumulator, type Clock, type Site } from "./oplog-rle";
import PriorityQueue from "./pq";

/** An append-only list of immutable operations */
export class OpLog<T, AccT extends Accumulator<T> = T[]> extends RleOpLog<
	T,
	AccT
> {
	/** `parents` for next Op */
	frontier: Clock[] = [];
	/** Indices into `this.fields` for each site. */
	stateVector: Record<Site, number> = {};

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

	//idToClock(site: Site, clock: Clock): Clock {
	//	const res = this.idClocks[site]?.[clock];
	//	if (!res) {
	//		debugPrint(this);
	//		throw new Error(`Id (${site},${clock}) does not exist`);
	//	}
	//	return res;
	//}

	merge(src: OpLog<T, AccT>) {
		//const missing = Object.entries(src.stateVector.diff(this.stateVector));
		//if (!missing.length) return;
		//
		//let i = missing.reduce((acc, [site, clock]) =>
		//	Math.max(0, Math.min(acc, src.idToIdx({ site, clock })));
		// Number.POSITIVE_INFINITY);

		const { items } = src;
		const { fields } = items;
		for (let i = 0; i < items.length; i++) {
			const opSite = src.getSiteRaw(i);
			const opClock = fields.clock[i];
			const opLen = src.len(i);
			const offset = opClock + opLen - this.#nextClock(opSite);
			if (offset <= 0) continue;

			const opOffset = opLen - offset;
			const parents = src
				.getParentsRaw(i, opOffset)
				.map((srcClock) => {
					const { idx, offset } = src.offsetOf(srcClock);
					const site = src.getSiteRaw(idx);
					const clock = src.getClockRaw(idx, offset);
					return this.idToClock(site, clock);
				})
				.sort((a, b) => a - b);
			const deleted = src.getDeletedRaw(i);

			this.push(
				{
					site: this.getOrPutSite(opSite),
					clock: src.getClockRaw(i, opOffset),
					position: src.getPosRaw(i, opOffset, deleted),
					// @ts-ignore idc if diff subtype as long as fulfills interface
					items: src.getItemRaw(i).slice(opOffset),
					parents,
				},
				(opLen - opOffset) * (deleted ? -1 : 1),
			);
			this.frontier = advanceFrontier(this.frontier, this.length - 1, parents);
			this.stateVector[opSite] = opClock + opLen - 1;
		}
	}

	diff(a: Clock[], b: Clock[]): { aOnly: Clock[]; bOnly: Clock[] } {
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

	diff2(
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
	const f = frontier.filter((v) => !parents.includes(v));
	f.push(clock);
	return f.sort((a, b) => a - b);
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
			deleted: boolean;
			item: AccT;
			site: Site;
			clock: Clock;
			parents: number[];
		};
		const ops: Op[] = [];
		const { fields } = oplog.items;
		const rangeFields = oplog.ranges.fields;
		for (let i = 0; i < oplog.items.length; i++) {
			ops.push({
				start: rangeFields.start[i],
				len: rangeFields.len[i],
				position: fields.position[i],
				deleted: rangeFields.len[i] < 0,
				item: fields.items[i],
				site: oplog.sites[fields.site[i]],
				clock: fields.clock[i],
				parents: fields.parents[i],
			});
		}
		console.table(ops);
	}
}

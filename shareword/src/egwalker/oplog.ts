import { RleOpLog } from "./oplog-rle";
import type { Site, Clock, Id, Op } from "./oplog-rle";
import PriorityQueue from "./pq";

export type { Site, Clock, Id, Op };

/** An append-only list of immutable operations */
export class OpLog<T, ArrT extends ArrayLike<T> = T[]> extends RleOpLog<
	T,
	ArrT
> {
	/** Leaf nodes */
	frontier: Clock[] = [];
	/** Max known clock for each site. */
	stateVector: Record<Site, Clock> = {};

	#pushLocal(site: Site, pos: number, delCount: number, items?: ArrT) {
		const clock = (this.stateVector[site] ?? -1) + 1;

		this.push({ site, clock }, this.frontier, pos, delCount, items);
		this.frontier = [this.nextClock() - 1];
		this.stateVector[site] = clock - 1 + (items?.length || delCount);
	}

	insert(site: Site, pos: number, items: ArrT) {
		this.#pushLocal(site, pos, 0, items);
	}

	delete(site: Site, pos: number, delCount = 1) {
		this.#pushLocal(site, pos, delCount);
	}

	#idToClock(id: Id): Clock {
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

	// Assumes `src` uses the same encoding.
	merge(src: OpLog<T, ArrT>) {
		const { items } = src.ops;
		const { fields } = items;
		for (let i = 0; i < items.length; i++) {
			const id = fields.id[i];
			const opLen = src.ops.ranges.fields.len[i];
			if (this.stateVector[id.site] >= id.clock) continue;

			this.ops.push(
				{
					id,
					position: fields.position[i],
					deleted: fields.deleted[i],
					items: fields.items[i],
				},
				opLen,
			);
			this.stateVector[id.site] = id.clock + opLen - 1;
		}

		const parentItems = src.opsParents.items;
		for (let i = 0; i < parentItems.length; i++) {
			const srcStart = src.opsParents.ranges.fields.start[i];
			const srcLen = src.opsParents.ranges.fields.len[i];
			const srcParents = parentItems[i];

			const parents = srcParents
				.map((srcClock) => this.#idToClock(src.getId(srcClock)))
				.sort((a, b) => a - b);
			console.log("merge", srcStart, srcLen, srcParents, parents);
			this.opsParents.push(parents, srcLen);

			if (i === parentItems.length - 1) {
				this.frontier = advanceFrontier(
					this.frontier,
					this.nextClock() - 1,
					src.getParents(srcStart + srcLen - 1),
				);
			}
		}
	}

	diff(a: Clock[], b: Clock[]): { aOnly: Clock[]; bOnly: Clock[] } {
		type DiffFlag = "a" | "b" | "both";
		const flags: { [clock: Clock]: DiffFlag } = {};

		let numShared = 0;

		const queue = new PriorityQueue<Clock>((a, b) => b - a);

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

export function debugPrint<T, ArrT extends ArrayLike<T>>(
	oplog: OpLog<T, ArrT>,
	full = false,
) {
	console.log("frontier", oplog.frontier);
	console.log("stateVector", oplog.stateVector);

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
		for (let i = 0; i < oplog.ops.length; i++) {
			const id = oplog.getId(i);

			ops.push({
				position: oplog.getPos(i),
				deleted: oplog.getDeleted(i),
				item: oplog.getContent(i) ?? "",
				site: id.site,
				clock: id.clock,
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
			item: ArrT;
			site: Site;
			clock: Clock;
		};
		const ops: Op[] = [];
		const { fields } = oplog.ops.items;
		const rangeFields = oplog.ops.ranges.fields;
		for (let i = 0; i < oplog.ops.items.length; i++) {
			ops.push({
				start: rangeFields.start[i],
				len: rangeFields.len[i],
				position: fields.position[i],
				deleted: fields.deleted[i],
				item: fields.items[i],
				site: fields.id[i].site,
				clock: fields.id[i].clock,
			});
		}
		console.table(ops);
		type OpParent = {
			start: number;
			len: number;
			parents: Clock[];
		};
		const opParents: OpParent[] = [];
		for (let i = 0; i < oplog.opsParents.items.length; i++) {
			opParents.push({
				start: oplog.opsParents.ranges.fields.start[i],
				len: oplog.opsParents.ranges.fields.len[i],
				parents: oplog.opsParents.items[i],
			});
		}
		console.table(opParents);
	}
}

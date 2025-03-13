import { RleOpLog } from "./oplog-rle";
import type { Site, Clock, Id, Op } from "./oplog-rle";
import PriorityQueue from "./pq";

export type { Site, Clock, Id, Op };

export function advanceFrontier(
	frontier: Clock[],
	clock: Clock,
	parents: Clock[],
): Clock[] {
	const f = frontier.filter((v) => !parents.includes(v));
	f.push(clock);
	return f.sort((a, b) => a - b);
}

/** An append-only list of immutable operations */
export class OpLog<T, ArrT extends ArrayLike<T>> extends RleOpLog<T, ArrT> {
	/** Leaf nodes */
	frontier: Clock[] = [];
	/** Max known clock for each site. */
	stateVector: Record<Site, Clock> = {};

	#pushLocal(site: Site, pos: number, delCount: number, items?: ArrT) {
		let clock = (this.stateVector[site] ?? -1) + 1;

		this.push({ site, clock }, this.frontier, pos, delCount, items);
		clock = this.nextClock() - 1;
		this.frontier = [clock];
		this.stateVector[site] = clock;
	}

	insert(site: Site, pos: number, items: ArrT) {
		this.#pushLocal(site, pos, 0, items);
	}

	delete(site: Site, pos: number, delCount: number) {
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
			throw `Id (${site},${clock}) does not exist`;
		}

		return (
			this.ops.ranges.fields.start[idx] +
			clock -
			this.ops.items.fields.id[idx].clock
		);
	}

	merge(src: OpLog<T, ArrT>) {
		for (let i = 0; i < src.ops.length; i++) {
			const { fields } = src.ops.items;
			const opPos = fields.position[i];
			const opDelCount = fields.deleteCount[i];
			const opItem = fields.items[i];
			const opId = fields.id[i];
			const opLen = src.ops.ranges.fields.len[i];

			const opParents = src.opsParents.items[i];
			const lastClock = this.stateVector[opId.site] ?? -1;
			if (lastClock >= opId.clock) continue;

			const parents = opParents
				.map((srcClock) => this.#idToClock(src.getId(srcClock)))
				.sort((a, b) => a - b);
			const nextClock = this.nextClock();

			this.push(opId, parents, opPos, opDelCount, opItem);
			this.frontier = advanceFrontier(
				this.frontier,
				nextClock + opLen - 1,
				parents,
			);
			//assert(clock == lastKnownSeq + 1);
			this.stateVector[opId.site] = opId.clock + opLen - 1;
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
		console.log("diff2", a, b);
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

import { RleOpLog, type Accumulator } from "./oplog-rle";
import PriorityQueue from "./pq";
import StateVector, { type Clock, type Site } from "./util/state-vector";

/** An append-only list of immutable operations */
export class OpLog<T, AccT extends Accumulator<T> = T[]> extends RleOpLog<
	T,
	AccT
> {
	/** `parents` for next Op */
	frontier: Clock[] = [];
	/** Max known clock for each site. */
	stateVector = new StateVector();

	insert(site: Site, pos: number, items: AccT) {
		const clock = (this.stateVector.clocks[site] ?? -1) + 1;
		this.insertRle({ site, clock }, this.frontier, pos, items);
		this.frontier = [this.length - 1];
		this.stateVector.clocks[site] = clock + items.length - 1;
	}

	delete(site: Site, pos: number, delCount = 1) {
		const clock = (this.stateVector.clocks[site] ?? -1) + 1;
		this.deleteRle({ site, clock }, this.frontier, pos, delCount);
		this.frontier = [this.length - 1];
		this.stateVector.clocks[site] = clock + delCount - 1;
	}

	merge(src: OpLog<T, AccT>) {
		const { items } = src;
		const { fields } = items;
		for (let i = 0; i < items.length; i++) {
			const id = fields.id[i];
			const opLen = src.ranges.fields.len[i];
			const offset =
				id.clock + opLen - (this.stateVector.clocks[id.site] ?? -1) - 1;
			if (offset <= 0) continue;

			const opOffset = opLen - offset;

			const parents = src
				.getParentsRaw(i, opOffset)
				.map((srcClock) => this.idToClock(src.getId(srcClock)))
				.sort((a, b) => a - b);
			const deleted = src.getDeletedRaw(i);

			this.push(
				{
					id: src.getIdRaw(i, opOffset),
					position: src.getPosRaw(i, opOffset, deleted),
					deleted,
					// @ts-ignore idc if diff subtype as long as fulfills interface
					items: src.getItemRaw(i).slice(opOffset),
					parents,
				},
				opLen - opOffset,
			);
			this.frontier = advanceFrontier(
				this.frontier,
				this.length - 1,
				parents,
			);
			this.stateVector.clocks[id.site] = id.clock + opLen - 1;
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
			const id = oplog.getId(i);

			ops.push({
				position: oplog.getPos(i),
				deleted: oplog.getDeleted(i),
				item: oplog.getItem(i) ?? "",
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
				deleted: fields.deleted[i],
				item: fields.items[i],
				site: fields.id[i].site,
				clock: fields.id[i].clock,
				parents: fields.parents[i],
			});
		}
		console.table(ops);
	}
}

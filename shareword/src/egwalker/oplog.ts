import {
	opLength,
	opSlice,
	OpType,
	opType,
	type Accumulator,
	type Clock,
	type Op,
	type OpData,
	type OpRun,
	type Site,
} from "./op";
import { Patch, type StateVector } from "./patch";
import { assertBounds, MultiArrayList, Rle } from "./util";

type RleOp<T, AccT extends Accumulator<T>> = {
	site: Site; // TODO: number
	siteClock: number;
	position: number;
	data: OpData<T, AccT>;
};

/** An append-only list of immutable operations */
export class OpLog<T, AccT extends Accumulator<T> = T[]> {
	ops: Rle<RleOp<T, AccT>, MultiArrayList<RleOp<T, AccT>>>;
	/** For items whose parents do not immediately precede it. */
	parents: Record<Clock, number[]> = {};
	/** Next Op's `parents`. */
	frontier: Clock[] = [];
	stateVector: StateVector = {};

	/** @param mergeFn How to merge runs together. */
	constructor(public mergeFn: (acc: AccT, cur: AccT) => AccT) {
		this.ops = new Rle(
			new MultiArrayList<RleOp<T, AccT>>({
				site: "",
				siteClock: 0,
				position: 0,
				data: 0,
			}),
			(ctx, item, len) => {
				const { fields } = ctx.items;
				const prevIdx = ctx.starts.length - 1;
				const prevLen = ctx.len(prevIdx);

				const prevPos = fields.position[prevIdx];
				const prevSite = fields.site[prevIdx];
				const prevClock = fields.siteClock[prevIdx];

				// non-consecutive id?
				if (prevSite !== item.site || prevClock + prevLen !== item.siteClock)
					return false;

				const ty = opType(fields.data[prevIdx]);
				if (ty !== opType(item.data)) return false;

				switch (ty) {
					case OpType.Insertion:
						if (prevPos + prevLen === item.position) {
							fields.data[prevIdx] = mergeFn(
								fields.data[prevIdx] as AccT,
								item.data as AccT,
							);
							return true;
						}
						break;
					case OpType.Deletion:
						if (prevPos === item.position) {
							(fields.data[prevIdx] as number) -= len;
							return true;
						}
						break;
				}
				return false;
			},
			opSlice,
		);
	}

	parentsAt(clock: Clock): Clock[] {
		assertBounds(clock, this.ops.length);
		return this.parents[clock] ?? [clock - 1];
	}

	itemAt(clock: Clock): Op<T> & { clock: number } {
		const op = this.ops.at(clock);
		const parents = this.parentsAt(clock);
		let data: T | number = op.data as number;
		switch (opType(op.data)) {
			case OpType.Insertion:
				data = (op.data as AccT)[0];
				break;
			case OpType.Deletion:
				data = -1;
				break;
		}
		return {
			clock,
			site: op.site,
			siteClock: op.siteClock,
			position: op.position,
			data,
			parents,
		};
	}

	at(idx: number): OpRun<T, AccT> & { start: number; length: number } {
		const op = this.ops.items.at(idx);
		const start = this.ops.starts[idx];
		const data = op.data;
		return {
			start,
			length: opLength(data),
			site: op.site,
			siteClock: op.siteClock,
			position: op.position,
			data,
			parents: this.parentsAt(start),
		};
	}

	#nextSiteClock(site: Site): Clock {
		return this.stateVector[site] ?? 0;
	}

	/** @returns If inserted a new item. */
	#insertParents(clock: Clock, parents: Clock[]): boolean {
		if (parents.length === 1 && parents[0] === clock - 1) return false;
		this.parents[clock] = parents;
		return true;
	}

	push(run: OpRun<T, AccT>): void {
		const { parents, ...rest } = run;
		const len = opLength(run.data);
		// Adding a new run at every merge point greatly simplifies diffing,
		// merging, and integrating. These other operations all optimize on this
		// fact.
		const forceNewRun = this.#insertParents(this.ops.length, parents);
		this.ops.push(rest, len, forceNewRun);
		this.frontier = advanceFrontier(
			this.frontier,
			this.ops.length - 1,
			parents,
		);
		this.stateVector[rest.site] = run.siteClock + len;
	}

	insert(site: Site, position: number, items: AccT) {
		this.push({
			site,
			siteClock: this.#nextSiteClock(site),
			data: items,
			position,
			parents: this.frontier,
		});
	}

	delete(site: Site, position: number, delCount = 1) {
		this.push({
			site,
			siteClock: this.#nextSiteClock(site),
			data: -delCount,
			position,
			parents: this.frontier,
		});
	}

	merge(src: OpLog<T, AccT>) {
		new Patch(src, this.stateVector).apply(this);
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

type DebugRow<T, AccT extends Accumulator<T>> = {
	start: number;
	id: string;
	position: number;
	data: OpData<T, AccT>;
	parents: number[];
};
export function debugRows<T, AccT extends Accumulator<T>>(
	oplog: OpLog<T, AccT>,
): DebugRow<T, AccT>[] {
	const res: DebugRow<T, AccT>[] = [];
	for (let i = 0; i < oplog.ops.items.length; i++) {
		const run = oplog.at(i);
		res.push({
			start: run.start,
			id: `${run.site}${run.siteClock}`,
			position: run.position,
			data: run.data,
			parents: run.parents,
		});
	}
	return res;
}

type DebugRow2<T, AccT extends Accumulator<T>> = [
	id: string,
	position: number,
	data: OpData<T, AccT>,
	parents: number[],
];
export function debugRows2<T, AccT extends Accumulator<T>>(
	oplog: OpLog<T, AccT>,
): DebugRow2<T, AccT>[] {
	const res: DebugRow2<T, AccT>[] = [];
	for (let i = 0; i < oplog.ops.items.length; i++) {
		const run = oplog.at(i);
		res.push([
			`${run.site}${run.siteClock}`,
			run.position,
			run.data,
			run.parents,
		]);
	}
	return res;
}

export function debugPrint<T, AccT extends Accumulator<T>>(
	oplog: OpLog<T, AccT>,
	full = false, // TODO: remove
) {
	if (full) {
		type Op = {
			id: string;
			position: number;
			data: T | number;
			parents: Clock[];
		};
		const ops: Op[] = [];
		for (let i = 0; i < oplog.ops.length; i++) {
			const item = oplog.itemAt(i);
			ops.push({
				id: `${item.site}${item.siteClock}`,
				position: item.position,
				data: item.data,
				parents: oplog.parentsAt(i),
			});
		}
		console.table(ops);
	} else {
		const rows = debugRows(oplog);
		console.table(rows);
	}
}

import { Frontier } from "./frontier";
import {
	maxRunLen,
	opLength,
	opSlice,
	OpType,
	opType,
	refDecode,
	refEncode,
} from "./op";
import type { Accumulator, Clock, OpData, OpRef, OpRun, Site } from "./op";
import { Patch, type StateVector } from "./patch";
import { assertBounds, Rle } from "./util";

type RleOp<T, AccT extends Accumulator<T>> = {
	site: Site; // TODO: number
	siteClock: number;
	position: number;
	data: OpData<T, AccT>;
};

/** An append-only list of immutable operations */
export class OpLog<T, AccT extends Accumulator<T> = T[]> {
	ops: Rle<RleOp<T, AccT>>;
	/** For items whose parents do not immediately precede it. */
	parents: Record<number /** index into `ops` */, OpRef[]> = {};
	/** Next Op's `parents`. */
	frontier = new Frontier<OpRef>();
	stateVector: StateVector = {};

	/** @param mergeFn How to merge runs together. */
	constructor(public mergeFn: (acc: AccT, cur: AccT) => AccT) {
		this.ops = new Rle<RleOp<T, AccT>>(
			[],
			(ctx, item, len) => {
				const prevIdx = ctx.starts.length - 1;
				const prevLen = ctx.len(prevIdx);
				const prev = ctx.items[prevIdx];

				// over max length?
				if (prevLen + len >= maxRunLen) return false;

				// non-consecutive id?
				if (
					prev.site !== item.site ||
					prev.siteClock + prevLen !== item.siteClock
				)
					return false;

				const ty = opType(prev.data);
				if (ty !== opType(item.data)) return false;

				switch (ty) {
					case OpType.Insertion:
						if (prev.position + prevLen === item.position) {
							prev.data = mergeFn(prev.data as AccT, item.data as AccT);
							return true;
						}
						break;
					case OpType.Deletion:
						if (prev.position === item.position) {
							(prev.data as number) -= len;
							return true;
						}
						break;
				}
				return false;
			},
			opSlice,
		);
	}

	#refDec(ref: OpRef): OpRef {
		const [idx, offset] = refDecode(ref);
		return offset ? ref - 1 : refEncode(idx - 1, this.ops.len(idx - 1) - 1);
	}

	parentsAt(ref: OpRef): OpRef[] {
		const [idx, offset] = refDecode(ref);
		assertBounds(idx, this.ops.length);
		if (offset || !this.parents[idx]) return [this.#refDec(ref)];
		return this.parents[idx];
	}

	at(idx: number, start?: number, end?: number): OpRun<T, AccT> {
		return opSlice(this.ops.items[idx], start, end);
	}

	#nextSiteClock(site: Site): Clock {
		return this.stateVector[site] ?? 0;
	}

	/** @returns If inserted a new item. */
	#insertParents(ref: OpRef, parents: OpRef[]): boolean {
		if (parents.length === 1 && parents[0] === this.#refDec(ref)) {
			return false;
		}
		this.parents[refDecode(ref)[0]] = parents;
		return true;
	}

	push(run: OpRun<T, AccT>, parents = this.frontier.slice()): void {
		const len = opLength(run.data);
		// Adding a new run at every merge point greatly simplifies diffing,
		// merging, and integrating. These other operations all optimize on this
		// fact.
		const ref = refEncode(this.ops.items.length, 0);
		const forceNewRun = this.#insertParents(ref, parents);
		this.ops.push(run, len, forceNewRun);
		const prevIdx = this.ops.items.length - 1;
		this.frontier.advance(
			parents,
			refEncode(prevIdx, this.ops.len(prevIdx) - 1),
		);
		this.stateVector[run.site] = run.siteClock + len;
	}

	insert(site: Site, position: number, items: AccT) {
		this.push({
			site,
			siteClock: this.#nextSiteClock(site),
			data: items,
			position,
		});
	}

	delete(site: Site, position: number, delCount = 1) {
		this.push({
			site,
			siteClock: this.#nextSiteClock(site),
			data: -delCount,
			position,
		});
	}

	merge(src: OpLog<T, AccT>) {
		new Patch(src, this.stateVector).apply(this);
	}
}

type DebugRow<T, AccT extends Accumulator<T>> = {
	id: string;
	position: number;
	data: OpData<T, AccT>;
	parents: ReturnType<typeof refDecode>[];
};
export function debugRows<T, AccT extends Accumulator<T>>(
	oplog: OpLog<T, AccT>,
): DebugRow<T, AccT>[] {
	const res: DebugRow<T, AccT>[] = [];
	for (let i = 0; i < oplog.ops.items.length; i++) {
		const run = oplog.at(i);
		res.push({
			id: `${run.site}${run.siteClock}`,
			position: run.position,
			data: run.data,
			parents: oplog.parentsAt(refEncode(i)).map(refDecode),
		});
	}
	return res;
}

type DebugRow2<T, AccT extends Accumulator<T>> = [
	id: string,
	position: number,
	data: OpData<T, AccT>,
	parents: ReturnType<typeof refDecode>[],
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
			oplog.parentsAt(refEncode(i)).map(refDecode),
		]);
	}
	return res;
}

export function debugPrint(oplog: OpLog<any, any>): void {
	const rows = debugRows(oplog);
	console.table(rows);
}

export function toDot(oplog: OpLog<any, any>): string {
	let res = `digraph { node[shape=rect] edge[dir=back]
`;

	const rows = debugRows(oplog);
	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		res += `${row.id}[label="${i}\\n${row.id}\\n${row.position}, ${row.data}"`;
		if (!row.parents.length) res += ',shape="Msquare"';
		res += "]\n";
		row.parents.forEach((pref) => {
			const [idx, offset] = pref;
			const parent = rows[idx];

			res += `${parent.id} -> ${row.id}`;
			if (offset !== oplog.ops.len(idx) - 1) res += `[label="${offset}"]`;
			res += "\n";
		});
	}

	return `${res}}`;
}

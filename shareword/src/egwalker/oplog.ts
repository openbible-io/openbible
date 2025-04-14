import { opLength, opSlice, OpType, opType, refDecode, refEncode } from "./op";
import type { Accumulator, Clock, OpData, OpRef, OpRun, Site } from "./op";
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
	/** Use a map since most `RleOp`s parents immediately precede it. */
	parents: Record<Clock, number[]> = {};
	/** Next Op's `parents`. */
	frontier: OpRef[] = [];
	stateVector: StateVector = {};

	constructor(public runMerge: (acc: AccT, cur: AccT) => AccT) {
		this.ops = new Rle(
			new MultiArrayList<RleOp<T, AccT>>({
				site: "",
				siteClock: 0,
				position: 0,
				data: 0,
			}),
			(ctx, item, len) => {
				const { fields } = ctx.items;
				const prevIdx = ctx.items.length - 1;
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
							fields.data[prevIdx] = runMerge(
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

	atSlice(idx: number, start?: number, end?: number): OpRun<T, AccT> {
		const op = this.ops.items.at(idx);
		const data = op.data;

		return opSlice<T, AccT>(
			{
				site: op.site,
				siteClock: op.siteClock,
				position: op.position,
				data,
			},
			start,
			end,
		);
	}

	at(ref: OpRef): OpRun<T, AccT> {
		const [idx, offset] = refDecode(ref);
		return this.atSlice(idx, offset);
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

	push(
		site: Site,
		position: number,
		data: OpData<T, AccT>,
		siteClock: Clock = this.#nextSiteClock(site),
		parents: OpRef[] = this.frontier,
	): void {
		const len = opLength(data);
		// Adding a new run at every merge point greatly simplifies diffing,
		// merging, and integrating. Otherwise we need a separate graph data
		// structure that indexes into our ops.
		//
		// That would save memory but complicate other algorithms.
		const ref = refEncode(this.ops.items.length, 0);
		const forceNewRun = this.#insertParents(ref, parents);
		this.ops.push({ site, siteClock, position, data }, len, forceNewRun);
		const prevIdx = this.ops.items.length - 1;
		this.frontier = advanceFrontier(
			this.frontier,
			parents,
			refEncode(prevIdx, this.ops.len(prevIdx) - 1),
		);
		this.stateVector[site] = siteClock + len;
	}

	insert(site: Site, position: number, items: AccT) {
		this.push(site, position, items);
	}

	delete(site: Site, position: number, delCount = 1) {
		this.push(site, position, -delCount);
	}

	merge(src: OpLog<T, AccT>) {
		new Patch(src, this.stateVector).apply(this);
	}
}

export function advanceFrontier(
	frontier: OpRef[],
	parents: OpRef[],
	clock: OpRef,
): OpRef[] {
	const res = frontier.filter((c) => !parents.includes(c));
	res.push(clock);
	return res.sort((a, b) => a - b);
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
		const ref = refEncode(i, 0);
		const run = oplog.at(ref);
		res.push({
			id: `${run.site}${run.siteClock}`,
			position: run.position,
			data: run.data,
			parents: oplog.parentsAt(ref).map(refDecode),
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
		const ref = refEncode(i, 0);
		const run = oplog.at(ref);
		res.push([
			`${run.site}${run.siteClock}`,
			run.position,
			run.data,
			oplog.parentsAt(ref).map(refDecode),
		]);
	}
	return res;
}

export function debugPrint(oplog: OpLog<any, any>) {
	console.table(debugRows(oplog));
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
		row.parents.forEach(pref => {
			const [idx, offset] = pref;
			const parent = rows[idx];

			res += `${parent.id} -> ${row.id}`;
			if (offset !== oplog.ops.len(idx) - 1) res += `[label="${offset}"]`;
			res += "\n";
		});
	}

	return `${res}}`;
}

import { maxRunLen, refEncode, opSlice, refDecode } from "./op";
import type { Accumulator, Clock, OpId, OpRef, OpRun, Site } from "./op";
import { debugPrint, type OpLog } from "./oplog";
import { assert } from "./util";

/** Max stored `clock` for each site. */
export type StateVector = Record<Site, number>;

export class Patch<T, AccT extends Accumulator<T>> {
	ops: OpRun<T, AccT>[] = [];
	// TODO: add special OpId that points into `ops`
	parents: Record<number, OpId[]> = {};

	constructor(oplog: OpLog<T, AccT>, to: StateVector) {
		for (let i = 0; i < oplog.ops.items.length; i++) {
			let run = oplog.at(i);
			const runLength = oplog.ops.len(i);
			if (run.siteClock + runLength <= to[run.site]) continue;

			const offset = Math.max((to[run.site] ?? -1) - run.siteClock, 0);
			const ref = refEncode(i, offset);
			const parents = oplog.parentsAt(ref).map((pref) => {
				const [idx, offset2] = refDecode(pref);
				const op = oplog.at(idx);
				return { site: op.site, siteClock: op.siteClock + offset2 };
			});
			if (offset) run = opSlice(run, offset);

			assert(offset < maxRunLen, `offset ${offset} >= ${maxRunLen}`);
			this.parents[this.ops.length] = parents;
			this.ops.push({ ...run });
		}
	}

	apply(oplog: OpLog<T, AccT>): void {
		for (let i = 0; i < this.ops.length; i++) {
			const run = this.ops[i];
			const parents = this.parents[i]
				.map((p) => idToRef(oplog, p.site, p.siteClock))
				.sort((a, b) => a - b);
			// TODO: check if already has op

			oplog.push(run, parents);
		}
	}
}

/** TODO: make fast. */
function idToRef<T, AccT extends Accumulator<T>>(
	oplog: OpLog<T, AccT>,
	site: Site,
	siteClock: Clock,
): OpRef {
	for (let i = oplog.ops.items.length - 1; i >= 0; i--) {
		const op = oplog.at(i);
		const opLength = oplog.ops.len(i);
		const offset = siteClock - op.siteClock;
		if (
			op.site === site &&
			offset >= 0 &&
			op.siteClock + opLength > siteClock
		) {
			return refEncode(i, offset);
		}
	}
	debugPrint(oplog);
	throw new Error(`Id (${site},${siteClock}) does not exist`);
}

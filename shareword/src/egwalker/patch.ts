import { maxRunLen, refEncode } from "./op";
import type { Accumulator, Clock, OpId, OpRef, OpRun, Site } from "./op";
import { debugPrint, type OpLog } from "./oplog";
import { assert, MultiArrayList } from "./util";

/** Max stored `clock` for each site. */
export type StateVector = Record<Site, number>;

export interface OpPatch<T, AccT extends Accumulator<T>>
	extends OpRun<T, AccT> {
	parents: OpId[];
}

export class Patch<T, AccT extends Accumulator<T>> {
	ops = new MultiArrayList<OpPatch<T, AccT>>({
		site: "",
		siteClock: 0,
		position: 0,
		data: 0,
		parents: [], // TODO: map
	});

	constructor(oplog: OpLog<T, AccT>, to: StateVector) {
		for (let i = 0; i < oplog.ops.items.length; i++) {
			const run = oplog.at(refEncode(i, 0));
			const runLength = oplog.ops.len(i);
			if (run.siteClock + runLength <= to[run.site]) continue;

			const offset = Math.max((to[run.site] ?? -1) - run.siteClock, 0);
			const ref = refEncode(i, offset);
			console.log(i, offset, oplog.parentsAt(ref))
			const parents = oplog.parentsAt(ref).map((ref) => {
				const op = oplog.at(ref);
				return { site: op.site, siteClock: op.siteClock };
			});

			assert(offset < maxRunLen, `offset ${offset} >= ${maxRunLen}`);
			this.ops.push({ ...oplog.at(ref), parents });
		}
	}

	apply(oplog: OpLog<T, AccT>): void {
		for (let i = 0; i < this.ops.length; i++) {
			const run = this.ops.at(i);
			const parents = run.parents
				.map((p) => idToRef(oplog, p.site, p.siteClock))
				.sort((a, b) => a - b);
			// TODO: check if already has op

			oplog.push(run.site, run.position, run.data, run.siteClock, parents);
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
		const ref = refEncode(i, 0);
		const op = oplog.at(ref);
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

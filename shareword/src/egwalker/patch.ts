import { opSlice, opType, OpType } from "./op";
import type { Accumulator, OpId, OpRun, Site } from "./op";
import type { OpLog } from "./oplog";
import { MultiArrayList } from "./util";

/** Max stored `clock` for each site. */
export type StateVector = Record<Site, number>;

export interface OpPatch<T, AccT extends Accumulator<T>>
	extends Omit<OpRun<T, AccT>, "parents"> {
	parents: OpId[];
}

export class Patch<T, AccT extends Accumulator<T>> {
	ops = new MultiArrayList<OpPatch<T, AccT>>({
		site: "",
		siteClock: 0,
		position: 0,
		data: 0,
		parents: [],
	});

	constructor(oplog: OpLog<T, AccT>, to: StateVector) {
		for (let i = 0; i < oplog.ops.items.length; i++) {
			const run = oplog.at(i);
			if (run.siteClock + run.length <= to[run.site]) continue;

			const offset =
				run.siteClock < to[run.site] ? to[run.site] - run.siteClock : 0;
			const parents = oplog.parentsAt(run.start + offset).map((clock) => {
				const op = oplog.itemAt(clock);
				return { site: op.site, siteClock: op.siteClock };
			});

			this.ops.push({
				site: run.site,
				siteClock: run.siteClock + offset,
				position:
					run.position + (opType(run.data) === OpType.Insertion ? offset : 0),
				data: opSlice(run.data, offset),
				parents,
			});
		}
	}

	apply(oplog: OpLog<T, AccT>): void {
		for (let i = 0; i < this.ops.length; i++) {
			const run = this.ops.at(i);
			const parents = run.parents
				.map((p) => oplog.idToClock(p.site, p.siteClock))
				.sort((a, b) => a - b);
			// TODO: check if already has op

			oplog.push({
				site: run.site,
				siteClock: run.siteClock,
				position: run.position,
				data: run.data,
				parents,
			});
		}
	}
}

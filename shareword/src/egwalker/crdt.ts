import { opType, OpType, refDecode, refEncode } from "./op";
import type { OpLog } from "./oplog";
import type { Accumulator, OpRef } from "./op";
import type { Snapshot } from "./snapshot";
import { assert } from "./util";
import { PriorityQueue } from "./util/pq";
import { CrdtList } from "./crdt-list";

/**
 * A CRDT document implemented as an Event Graph Walker.
 *
 * - https://arxiv.org/pdf/2409.14252
 */
export class Crdt<T, AccT extends Accumulator<T>> extends CrdtList<T, AccT> {
	constructor(
		private oplog: OpLog<T, AccT>,
		private currentVersion: OpRef[],
		placeholderOffset: number,
		placeholderLength: number,
	) {
		super(
			(ref: OpRef) => oplog.at(refDecode(ref)[0]).site,
			placeholderOffset,
			placeholderLength,
		);
	}

	#diff(a: OpRef[], b: OpRef[]): { aOnly: OpRef[]; bOnly: OpRef[] } {
		type DiffFlag = "a" | "b" | "both";
		const flags: { [ref: OpRef]: DiffFlag } = {};
		const queue = new PriorityQueue<OpRef>((a, b) => b - a);
		let numShared = 0;

		function enq(v: OpRef, flag: DiffFlag) {
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

		const aOnly: OpRef[] = [];
		const bOnly: OpRef[] = [];

		while (queue.length > numShared) {
			// biome-ignore lint/style/noNonNullAssertion: size check above
			const ref = queue.pop()!;
			const flag = flags[ref];

			if (flag === "a") aOnly.push(ref);
			else if (flag === "b") bOnly.push(ref);
			else numShared--;

			for (const p of this.oplog.parentsAt(ref)) enq(p, flag);
		}

		return { aOnly, bOnly };
	}

	#apply(ref: OpRef, snapshot?: Snapshot<T>) {
		const [i, start] = refDecode(ref);
		const op = this.oplog.at(i, start, start + 1);

		switch (opType(op.data)) {
			case OpType.Deletion: {
				this.delete(ref, op.position, 1, snapshot);
				break;
			}
			case OpType.Insertion: {
				this.insert(ref, op.position, op.data as AccT, snapshot);
				break;
			}
			default:
				assert(false, `invalid op ${op.data}`);
		}
	}

	applyOpRun(idx: number, start: number, end: number, snapshot?: Snapshot<T>) {
		//console.log(
		//	"applyOpRun",
		//	idx,
		//	start,
		//	end,
		//	this.oplog.atSlice(idx, start, end).data,
		//);

		for (let i = start; i < end; i++) {
			const ref = refEncode(idx, i);
			const parents = this.oplog.parentsAt(ref);
			const { aOnly, bOnly } = this.#diff(this.currentVersion, parents);
			//if (aOnly.length || bOnly.length)
			//	console.log({
			//		aOnly: aOnly.map(refDecode),
			//		bOnly: bOnly.map(refDecode),
			//	});

			for (const ref of aOnly) this.retreat(ref);
			for (const ref of bOnly) this.advance(ref);
			this.#apply(ref, snapshot);
			this.currentVersion = [ref];
		}
	}
}

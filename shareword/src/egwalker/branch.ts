import { advanceFrontier, type OpLog } from "./oplog";
import { Crdt } from "./crdt";
import type { Snapshot } from "./snapshot";
import { PriorityQueue } from "./util/pq";
import { refDecode, refEncode } from "./op";
import type { Accumulator, OpRef } from "./op";

type OpRange = {
	start: OpRef;
	/** Inclusive of last index, non-inclusive of last offset. */
	end: OpRef;
};
type LongOpRange = {
	idx: number;
	start: number;
	end: number;
};
type HeadResult = {
	/** First common op */
	head: OpRef[];
	shared: OpRange;
	bOnly: OpRange;
};

export class Branch<T, AccT extends Accumulator<T>> {
	frontier: OpRef[] = [];

	constructor(public oplog: OpLog<T, AccT>) {}

	/**
	 * Finds the nearest shared operation of `a` and `b`.
	 *
	 * Invariant: directed graph
	 */
	#findHead(a: OpRef[], b: OpRef[]): HeadResult {
		type MergePoint = {
			refs: OpRef[];
			inA: boolean;
		};
		const res: HeadResult = {
			head: [],
			shared: {
				start: Number.POSITIVE_INFINITY,
				end: Number.NEGATIVE_INFINITY,
			},
			bOnly: { start: Number.POSITIVE_INFINITY, end: Number.NEGATIVE_INFINITY },
		};

		const queue = new PriorityQueue<MergePoint>((a, b) =>
			cmpOpRefs(b.refs, a.refs),
		);

		const enq = (localOpRefs: OpRef[], inA: boolean) => {
			queue.push({
				refs: localOpRefs.toSorted((a, b) => b - a),
				inA,
			});
		};

		enq(a, true);
		enq(b, false);

		let next: MergePoint | undefined;
		while ((next = queue.pop())) {
			if (next.refs.length === 0) break; // root element
			let inA = next.inA;

			let peek: MergePoint | undefined;
			// multiple elements may have same merge point
			while ((peek = queue.peek())) {
				if (cmpOpRefs(next.refs, peek.refs)) break;

				queue.pop();
				if (peek.inA) inA = true;
			}

			if (!queue.length) {
				res.head = next.refs.reverse();
				break;
			}

			if (next.refs.length > 1) {
				for (const lc of next.refs) enq([lc], inA);
			} else {
				const ref = next.refs[0];
				if (inA) {
					res.shared.start = ref;
					res.shared.end = Math.max(res.shared.end, ref + 1);
				} else {
					res.bOnly.start = ref;
					res.bOnly.end = Math.max(res.bOnly.end, ref + 1);
				}

				enq(this.oplog.parentsAt(ref), inA);
			}
		}

		return res;
	}

	*runs(range: OpRange): Generator<LongOpRange> {
		const [startIdx, startOff] = refDecode(range.start);
		const [endIdx, endOff] = refDecode(range.end);
		for (let i = startIdx; i <= endIdx; i++) {
			const start = i === startIdx ? startOff : 0;
			const end = i === endIdx ? endOff : this.oplog.ops.len(i);
			if (end <= start) continue;

			yield { idx: i, start, end };
		}
	}

	checkout(mergeFrontier: OpRef[], snapshot?: Snapshot<T>) {
		// 4%
		const { head, shared, bOnly } = this.#findHead(
			this.frontier,
			mergeFrontier,
		);
		//debugPrint(this.oplog);
		//console.log("checkout");
		//console.log(this.frontier.map((r) => refDecode(r).toString()));
		//console.log(mergeFrontier.map((r) => refDecode(r).toString()));
		//console.log(head.map((r) => refDecode(r).toString()));
		//console.log(refDecode(shared.start).toString(), refDecode(shared.end).toString());
		//console.log(refDecode(bOnly.start).toString(), refDecode(bOnly.end).toString());

		// 5%
		const doc = new Crdt(
			this.oplog,
			head,
			refEncode(this.oplog.ops.items.length, 0),
			this.oplog.ops.length,
		);

		// 46%
		for (const { idx, start, end } of this.runs(shared)) {
			doc.applyOpRun(idx, start, end);
		}
		for (const { idx, start, end } of this.runs(bOnly)) {
			doc.applyOpRun(idx, start, end, snapshot);

			const ref = refEncode(idx, end - 1);
			advanceFrontier(this.frontier, this.oplog.parentsAt(refEncode(idx)), ref);
		}
	}
}

function cmpOpRefs(a: OpRef[], b: OpRef[]): number {
	for (let i = 0; i < a.length; i++) {
		if (b.length <= i) return 1;

		const delta = a[i] - b[i];
		if (delta) return delta;
	}

	return a.length < b.length ? -1 : 0;
}

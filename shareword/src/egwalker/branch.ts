import { advanceFrontier, type OpLog } from "./oplog";
import { Crdt, State, type Item } from "./crdt";
import type { Snapshot } from "./snapshot";
import { PriorityQueue } from "./util/pq";
import { refDecode, refEncode } from "./op";
import type { Accumulator, OpRef } from "./op";

type OpRange = {
	start: OpRef;
	/** Inclusive of last index, non-inclusive of last offset. */
	end: OpRef;
};
function* opRangeIter(
	range: OpRange,
	len: (idx: number) => number,
): Generator<OpRef> {
	const [startIdx, startOffset] = refDecode(range.start);
	const [endIdx, endOffset] = refDecode(range.end);
	for (let i = startIdx; i <= endIdx; i++) {
		for (
			let j = i === startIdx ? startOffset : 0;
			j < (i === endIdx ? endOffset : len(i));
			j++
		) {
			yield refEncode(i, j);
		}
	}
}
type HeadResult = {
	/** First common op */
	head: OpRef[];
	shared: OpRange;
	bOnly: OpRange;
};

export class Branch<T, AccT extends Accumulator<T>> {
	frontier: OpRef[] = [];

	constructor(public oplog: OpLog<T, AccT>) {}

	/** Invariant: directed graph */
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
					res.shared.start = Math.min(res.shared.start, ref);
					res.shared.end = Math.max(res.shared.end, ref + 1);
				} else {
					res.bOnly.start = Math.min(res.bOnly.start, ref);
					res.bOnly.end = Math.max(res.bOnly.end, ref + 1);
				}

				enq(this.oplog.parentsAt(ref), inA);
			}
		}

		return res;
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

		const doc = new Crdt(this.oplog);
		doc.currentVersion = head;

		// 5%
		const placeholderLength = this.oplog.ops.length;
		const placeholderOffset = refEncode(this.oplog.ops.items.length, 0);
		for (let i = 0; i < placeholderLength; i++) {
			const item: Item = {
				ref: placeholderOffset + i,
				site: "",
				state: State.Inserted,
				deleted: false,
				originLeft: -1,
				originRight: -1,
			};
			doc.items.push(item);
			doc.targets[item.ref] = item;
		}

		// 46%
		const len = (i: number) => this.oplog.ops.len(i);
		for (const ref of opRangeIter(shared, len)) doc.applyOp(ref);
		for (const ref of opRangeIter(bOnly, len)) {
			doc.applyOp(ref, snapshot);
			this.frontier = advanceFrontier(
				this.frontier,
				this.oplog.parentsAt(ref),
				ref,
			);
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

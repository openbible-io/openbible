import { advanceFrontier, type OpLog } from "./oplog";
import { Crdt, State, type Item } from "./crdt";
import type { Snapshot } from "./snapshot";
import { PriorityQueue } from "./util/pq";
import { refEncode, type Accumulator, type OpRef } from "./op";
import { assert } from "./util";

export class Branch<T, AccT extends Accumulator<T>> {
	frontier: OpRef[] = [];

	constructor(public oplog: OpLog<T, AccT>) {}

	#diff(
		from: OpRef[],
		dest: OpRef[],
	): {
		head: OpRef[];
		shared: OpRef[];
		destOnly: OpRef[];
	} {
		type MergePoint = {
			refs: OpRef[];
			inFrom: boolean;
		};

		const queue = new PriorityQueue<MergePoint>((a, b) =>
			cmpClocks(b.refs, a.refs),
		);

		const enq = (refs: OpRef[], inA: boolean) => {
			queue.push({
				refs: refs.toSorted((a, b) => b - a),
				inFrom: inA,
			});
		};

		enq(from, true);
		enq(dest, false);

		let head: OpRef[] = [];
		const shared = [];
		const bOnly = [];

		let next: MergePoint | undefined;
		while ((next = queue.pop())) {
			if (next.refs.length === 0) break; // root element
			let inFrom = next.inFrom;

			let peek: MergePoint | undefined;
			// multiple elements may have same merge point
			while ((peek = queue.peek())) {
				if (cmpClocks(next.refs, peek.refs)) break;

				queue.pop();
				if (peek.inFrom) inFrom = true;
			}

			if (!queue.length) {
				head = next.refs.reverse();
				break;
			}

			if (next.refs.length > 1) {
				for (const ref of next.refs) enq([ref], inFrom);
			} else {
				assert(next.refs.length === 1, `too long ${next.refs}`);
				const ref = next.refs[0];
				if (inFrom) shared.push(ref);
				else bOnly.push(ref);

				enq(this.oplog.parentsAt2(ref), inFrom);
			}
		}

		return {
			head,
			shared: shared.reverse(),
			destOnly: bOnly.reverse(),
		};
	}

	checkout(mergeFrontier: OpRef[], snapshot?: Snapshot<T>) {
		const { head, shared, destOnly } = this.#diff(
			this.frontier,
			mergeFrontier,
		);
		//debugPrint(this.oplog);
		//console.log(
		//	"checkout",
		//	this.frontier.map(refDecode),
		//	mergeFrontier.map(refDecode),
		//	head.map(refDecode),
		//	shared.map(refDecode),
		//	bOnly.map(refDecode),
		//);

		const doc = new Crdt(this.oplog);
		doc.currentVersion = head;

		const placeholderLength = this.frontier[this.frontier.length - 1] + 1;
		const placeholderOffset = refEncode(2 ** 32, 0);
		for (let i = 0; i < placeholderLength; i++) {
			const item: Item = {
				ref: placeholderOffset + i,
				length: 1,
				site: "",
				state: State.Inserted,
				deleted: false,
				originLeft: -1,
				originRight: -1,
			};
			doc.items.push(item);
			doc.targets[item.ref] = item;
		}

		for (const ref of shared) doc.applyOp(ref);
		for (const ref of destOnly) {
			doc.applyOp(ref, snapshot);
			this.frontier = advanceFrontier(
				this.frontier,
				this.oplog.parentsAt(ref),
				ref,
			);
		}
	}
}

function cmpClocks(a: OpRef[], b: OpRef[]): number {
	for (let i = 0; i < a.length; i++) {
		if (b.length <= i) return 1;

		const delta = a[i] - b[i];
		if (delta) return delta;
	}

	return a.length < b.length ? -1 : 0;
}

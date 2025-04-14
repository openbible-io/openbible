import { advanceFrontier, type OpLog } from "./oplog";
import { Crdt, State, type Item } from "./crdt";
import type { Snapshot } from "./snapshot";
import { PriorityQueue } from "./util/pq";
import { refDecode, refEncode, type Accumulator, type OpRef } from "./op";
import { assert } from "./util";

export class Branch<T, AccT extends Accumulator<T>> {
	frontier: OpRef[] = [];

	constructor(public oplog: OpLog<T, AccT>) {}

	#diff(
		src: OpRef[],
		dest: OpRef[],
	): {
		head: OpRef[];
		shared: OpRef[];
		destOnly: OpRef[];
	} {
		type MergePoint = {
			refs: OpRef[];
			inSrc: boolean;
		};

		const queue = new PriorityQueue<MergePoint>((a, b) =>
			cmpClocks(b.refs, a.refs),
		);

		const enq = (refs: OpRef[], inSrc: boolean) => {
			queue.push({
				refs: refs.toSorted((a, b) => b - a),
				inSrc,
			});
		};

		enq(src, true);
		enq(dest, false);

		let head: OpRef[] = [];
		const shared = [];
		const bOnly = [];

		let next: MergePoint | undefined;
		while ((next = queue.pop())) {
			if (next.refs.length === 0) break; // root element
			let inSrc = next.inSrc;

			let peek: MergePoint | undefined;
			// multiple elements may have same merge point
			while ((peek = queue.peek())) {
				if (cmpClocks(next.refs, peek.refs)) break;

				queue.pop();
				if (peek.inSrc) inSrc = true;
			}

			if (!queue.length) {
				head = next.refs;
				break;
			}

			if (next.refs.length > 1) {
				for (const ref of next.refs) enq([ref], inSrc);
			} else {
				assert(next.refs.length === 1, `too long ${next.refs}`);
				const [ref] = next.refs
				if (inSrc) shared.push(ref);
				else bOnly.push(ref);

				enq(this.oplog.parentsAt2(ref), inSrc);
			}
		}

		return {
			head: head.reverse(),
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
		console.log("checkout")
		console.log(this.frontier.map(r => refDecode(r).toString()))
		console.log(mergeFrontier.map(r => refDecode(r).toString()))
		console.log(head.map(r => refDecode(r).toString()))
		console.log(shared.map(r => refDecode(r).toString()))
		console.log(destOnly.map(r => refDecode(r).toString()))

		const doc = new Crdt(this.oplog);
		doc.currentVersion = head;

		const placeholderLength = this.oplog.ops.length;
		const placeholderOffset = refEncode(this.oplog.ops.items.length, 0);
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

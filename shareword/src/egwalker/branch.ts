import { advanceFrontier, type OpLog } from "./oplog";
import { Crdt, State, type Item } from "./crdt";
import type { Accumulator, Clock } from "./oplog-rle";
import type { Snapshot } from "./snapshot";
import { PriorityQueue } from "./util/pq";

function cmpClocks(a: Clock[], b: Clock[]): number {
	for (let i = 0; i < a.length; i++) {
		if (b.length <= i) return 1;

		const delta = a[i] - b[i];
		if (delta) return delta;
	}

	return a.length < b.length ? -1 : 0;
}

export class Branch<T, AccT extends Accumulator<T>> {
	frontier: Clock[] = [];

	constructor(public oplog: OpLog<T, AccT>) {}

	#diff(
		a: Clock[],
		b: Clock[],
	): {
		head: Clock[];
		shared: Clock[];
		bOnly: Clock[];
	} {
		type MergePoint = {
			clocks: Clock[];
			inA: boolean;
		};

		const queue = new PriorityQueue<MergePoint>((a, b) =>
			cmpClocks(b.clocks, a.clocks),
		);

		const enq = (localClocks: Clock[], inA: boolean) => {
			queue.push({
				clocks: localClocks.toSorted((a, b) => b - a),
				inA,
			});
		};

		enq(a, true);
		enq(b, false);

		let head: Clock[] = [];
		const shared = [];
		const bOnly = [];

		let next: MergePoint | undefined;
		while ((next = queue.pop())) {
			if (next.clocks.length === 0) break; // root element
			let inA = next.inA;

			let peek: MergePoint | undefined;
			// multiple elements may have same merge point
			while ((peek = queue.peek())) {
				if (cmpClocks(next.clocks, peek.clocks)) break;

				queue.pop();
				if (peek.inA) inA = true;
			}

			if (!queue.length) {
				head = next.clocks.reverse();
				break;
			}

			if (next.clocks.length > 1) {
				for (const lc of next.clocks) enq([lc], inA);
			} else {
				//assert(next.clocks.length == 1);
				const lc = next.clocks[0];
				if (inA) shared.push(lc);
				else bOnly.push(lc);

				enq(this.oplog.getParents(lc), inA);
			}
		}

		return {
			head,
			shared: shared.reverse(),
			bOnly: bOnly.reverse(),
		};
	}

	checkout(mergeFrontier: Clock[], snapshot?: Snapshot<T>) {
		const { head, shared, bOnly } = this.#diff(
			this.frontier,
			mergeFrontier,
		);
		//debugPrint(this.oplog);
		//console.log("checkout", this.frontier, mergeFrontier, head, shared, bOnly);

		const doc = new Crdt(this.oplog);
		doc.currentVersion = head;

		const placeholderLength = Math.max(...this.frontier) + 1;
		const placeholderOffset = this.oplog.length; // @seph: is this correct?
		for (let i = 0; i < placeholderLength; i++) {
			const item: Item = {
				clock: i + placeholderOffset,
				state: State.Inserted,
				deleted: false,
				originLeft: -1,
				originRight: -1,
			};
			doc.items.push(item);
			doc.targets[item.clock] = item;
		}

		for (const c of shared) doc.applyOp(c);
		for (const c of bOnly) {
			doc.applyOp(c, snapshot);
			this.frontier = advanceFrontier(
				this.frontier,
				c,
				this.oplog.getParents(c),
			);
		}
	}
}

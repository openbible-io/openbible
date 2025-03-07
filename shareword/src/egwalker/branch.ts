import PriorityQueue from "./pq";
import { advanceFrontier, type Clock, type OpLog } from "./oplog";
import { EgWalker, State, type Item } from "./egwalker";

export class Branch<T> {
	snapshot: T[] = [];
	frontier: Clock[] = [];

	checkoutFancy(oplog: OpLog<T>, mergeFrontier: Clock[] = oplog.frontier) {
		const { commonVersion, sharedOps, bOnlyOps } = findOpsToVisit(
			oplog,
			this.frontier,
			mergeFrontier,
		);

		const doc = new EgWalker();
		doc.currentVersion = commonVersion;

		const placeholderLength = Math.max(...this.frontier) + 1;
		for (let i = 0; i < placeholderLength; i++) {
			const item: Item = {
				clock: i + 1e12,
				state: State.Inserted,
				deleted: false,
				originLeft: -1,
				originRight: -1,
			};
			doc.items.push(item);
			doc.itemsByClock[item.clock] = item;
		}

		for (const lv of sharedOps) doc.doOp(oplog, lv);

		for (const lv of bOnlyOps) {
			doc.doOp(oplog, lv, this.snapshot);
			this.frontier = advanceFrontier(this.frontier, lv, oplog.ops[lv].parents);
		}
	}
}

function compareClocks(a: Clock[], b: Clock[]): number {
	for (let i = 0; i < a.length; i++) {
		if (b.length <= i) return 1;

		const delta = a[i] - b[i];
		if (delta !== 0) return delta;
	}

	if (a.length < b.length) return -1;
	return 0;
}

type OpsToVisit = {
	commonVersion: Clock[];
	sharedOps: Clock[];
	bOnlyOps: Clock[];
};

function findOpsToVisit(oplog: OpLog<any>, a: Clock[], b: Clock[]): OpsToVisit {
	// if (a.length === 0 && b.length === 0) return { start: [], common: [], bOnly: [] }

	type MergePoint = {
		v: Clock[]; // Sorted in inverse order (highest to lowest)
		isInA: boolean;
	};

	const queue = new PriorityQueue<MergePoint>((a, b) => {
		// What about when they have different isInA flags? It shouldn't matter.
		return compareClocks(b.v, a.v);
	});

	const enq = (lv: Clock[], isInA: boolean) => {
		const mergePoint = {
			v: lv.slice().sort((a, b) => b - a), // Sort in descending order.
			isInA,
		};
		queue.push(mergePoint);
	};

	enq(a, true);
	enq(b, false);

	let commonVersion: Clock[];
	const sharedOps = [];
	const bOnlyOps = [];

	// console.log('a', a, 'b', b)
	while (true) {
		let { v, isInA } = queue.pop()!;
		// console.log('deq', v, isInA)
		if (v.length === 0) {
			// We've hit the root element.
			commonVersion = [];
			break;
		}

		while (!queue.isEmpty()) {
			// We might have multiple elements that have the same merge point.
			const { v: peekV, isInA: peekIsInA } = queue.peek()!;
			if (compareClocks(v, peekV) !== 0) break;

			queue.pop();
			if (peekIsInA) isInA = true;
		}

		if (queue.isEmpty()) {
			commonVersion = v.reverse();
			break;
		}

		if (v.length >= 2) {
			for (const vv of v) enq([vv], isInA);
		} else {
			const lv = v[0];
			//assert(v.length == 1);
			if (isInA) sharedOps.push(lv);
			else bOnlyOps.push(lv);

			const op = oplog.ops[lv];
			enq(op.parents, isInA);
		}
	}

	return {
		commonVersion,
		sharedOps: sharedOps.reverse(),
		bOnlyOps: bOnlyOps.reverse(),
	};
}

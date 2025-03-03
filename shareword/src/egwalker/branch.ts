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

		for (const clock of sharedOps) doc.doOp(oplog, clock);

		for (const clock of bOnlyOps) {
			doc.doOp(oplog, clock, this.snapshot);
			const parents = oplog.parents[clock];
			this.frontier = advanceFrontier(this.frontier, clock, parents);
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

function findOpsToVisit<T>(oplog: OpLog<T>, a: Clock[], b: Clock[]): OpsToVisit {
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
		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		let { v, isInA } = queue.pop()!;
		if (v.length === 0) {
			// We've hit the root element.
			commonVersion = [];
			break;
		}

		while (!queue.isEmpty()) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
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
			//assert(v.length == 1);
			const clock = v[0];
			if (isInA) sharedOps.push(clock);
			else bOnlyOps.push(clock);

			const parents = oplog.parents[clock];
			enq(parents, isInA);
		}
	}

	return {
		commonVersion,
		sharedOps: sharedOps.reverse(),
		bOnlyOps: bOnlyOps.reverse(),
	};
}

import { assert, binarySearch, Rle } from "../util";
import type {
	Accumulator,
	Clock,
	Deletion,
	Insertion,
	Op,
	OpId,
	ReplicaId,
} from "./op";
import type { StateVector } from "./patch";

type Node<T, AccT extends Accumulator<T>> = {
	ops: Rle<Op<T, AccT>>;
	/** The nodes that "caused" this one. */
	parents: Node<T, AccT>[];
	/** Used when splitting this node. */
	children: Node<T, AccT>[];
};

type Parent<T, AccT extends Accumulator<T>> = {
	node: Node<T, AccT>;
	offset: number;
};

export class Oplog<T, AccT extends Accumulator<T>> {
	/** Ordered according to a function shared across replicas. */
	leaves: Node<T, AccT>[] = [];
	/** For lookup by `OpId` in O(log n). */
	//replicas: Record<ReplicaId, BTree<number, Node>>> = {};
	stateVector: StateVector = {};

	constructor(private mergeFn: (acc: AccT, cur: AccT) => AccT) { }

	//find(id: OpId): { node: Node<T, AccT>; offset: number } {
	//	const replica = this.replicas[id.replica];
	//	assert(replica, `contains ${JSON.stringify(id)}`);
	//	const { idx, offset } = replica.indexOf(id.clock);
	//	const node = replica.items[idx];
	//	const run = node.runs[offset];
	//	return {
	//		node,
	//		run,
	//		offset: id.clock - run.clock,
	//	};
	//}

	newRle(op: Op<T, AccT>): Rle<Op<T, AccT>> {
		const res = new Rle<Op<T, AccT>>(
			[],
			(ctx, cur) => {
				const prevIdx = ctx.items.length - 1;
				const prev = ctx.items[prevIdx];
				const prevLen = ctx.len(prevIdx);

				if (prev.type !== cur.type) return false;
				if (prev.type === "insertion" && prev.pos + prevLen === cur.pos) {
					prev.item = this.mergeFn(prev.item, (cur as Insertion<AccT>).item);
					return true;
				}
				if (prev.type === "deletion") {
					if (
						(prev.count > 0 && prev.pos === cur.pos) ||
						(prev.count < 0 && prev.pos === cur.pos + prev.count)
					) {
						prev.count += (cur as Deletion).count;
						return true;
					}
				}
				return false;
			},
			opSlice,
		);
		res.push(op, opLength(op));
		return res;
	}

	push(replica: ReplicaId, op: Op<T, AccT>, parents = this.leaves): void {
		// new root?
		if (!parents.length) {
			this.leaves.push({
				ops: this.newRle(op),
				parents,
				children: [],
			});
			return;
		}

		// continuing last run?
		if (parents.length === 1) {
			const parent = parents[0];
			if (this.leaves.includes(parents[0])) {
				parent.ops.push(op, opLength(op));
				return;
			}
		}

		// parents pointing to middle of existing nodes?
		// parents = parents.map((p) => this.maybeSplit(p.node, p.offset));

		// new node
		this.leaves.push({
			ops: this.newRle(op),
			parents,
			children: [],
		});

		//newNodes.sort((a, b) => {
		//	let diff = a.ops.length - b.ops.length;
		//	if (diff) return diff;
		//
		//	for (let i = 0; i < a.ops.length; i++) {
		//		diff = opCmp(a.ops[i], b.ops[i]);
		//		if (diff) return diff;
		//	}
		//	return 0;
		//})
	}

	insert(replica: ReplicaId, pos: number, item: AccT) {
		this.push(replica, { type: "insertion", pos, item });
	}

	delete(replica: ReplicaId, pos: number, count = 1) {
		this.push(replica, { type: "deletion", pos, count });
	}

	*climb(n: Node<T, AccT>, ctx = { map: new WeakMap(), count: 0 }): Generator<Node<T, AccT>> {
		ctx.map.set(n, ctx.count++);
		yield n;
		for (const parent of n.parents) {
			if (!ctx.map.has(parent)) this.climb(parent, ctx);
		}
	}


	//findHead(a: NodeRef[], b: NodeRef[]): { head: NodeRef[], shared: NodeRef[], bOnly: NodeRef[] } {
	//}
}

export function toDot(graph: Oplog<any, any>): string {
	let res = "digraph { node[shape=rect] edge[dir=both]\n";

	const ctx = { map: new WeakMap(), count: 0 };
	for (const leaf of graph.leaves) {
		for (const node of graph.climb(leaf, ctx)) {
			const ranges = node.ops.items
				.map((op) => {
					if (op.type === "insertion") return `${op.pos},${op.item}`;
					if (op.type === "deletion") return `${op.pos},${op.count}`;
				})
				.join(", ");
			const id = ctx.map.get(node);

			res += `${id}[label="${ranges}"]\n`;
			for (const child of node.children) {
				const childId = ctx.map.get(child);
				res += `${id} -> ${childId}\n`;
			}
		}
	}

	res += "}";
	return res;
}

function opLength(op: Op<any, any>): number {
	switch (op.type) {
		case "insertion":
			return op.item.length;
		case "deletion":
			return Math.abs(op.count);
	}
}

function opSlice<T, AccT extends Accumulator<T>>(
	item: Op<T, AccT>,
	start?: number,
	end?: number,
): Op<T, AccT> {
	switch (item.type) {
		case "deletion":
			// xxxxxx
			// p s  e
			// o t  n
			// s a  d
			if (item.count > 0) {
				return {
					type: "deletion",
					pos: item.pos + (start ?? 0),
					count: (end ?? item.count) - (start ?? 0),
				};
			} else {
				const pos = end ?? item.pos;
				// xxxxxx
				// s  e p
				// t  n o
				// a  d s
				return {
					type: "deletion",
					pos,
					count: pos - (start ?? 0),
				};
			}
		case "insertion":
			return { type: "insertion", pos: item.pos, item: item.item.slice(start, end) };
	}
}

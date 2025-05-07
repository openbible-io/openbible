import { assert, binarySearch, BTree, Rle } from "../util";
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
	ops: BTreeList<Op<T, AccT>>;
	/** The nodes that "caused" this one. */
	parents: Node<T, AccT>[];
	/** Used when splitting this node. */
	children: Node<T, AccT>[];
};

export class Oplog<T, AccT extends Accumulator<T>> {
	/** Ordered according to a function shared across replicas. */
	leaves: Node<T, AccT>[] = [];
	/** Stores replicas and allows lookup by `OpId` in O(log n). */
	replicas: Record<ReplicaId, BTree<number, { node: Node<T, AccT>, offset: number }>> = {};
	stateVector: StateVector = {};
	lastReplica?: ReplicaId;

	constructor(private mergeFn: (acc: AccT, cur: AccT) => AccT) {}

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

	maybeSplit(node: Node<T, AccT>, offset?: number): Node<T, AccT> {
		if (!offset) return node;

		// Important to maintain ref for other parents and `this.replicas`.
		const end: Node<T, AccT> = node;
		const start: Node<T, AccT> = {
			ops: node.ops.slice(0, offset),
			parents: node.parents,
			children: [end],
		};

		end.ops = end.ops.slice(offset);
		end.parents = [start];

		return start;
	}

	setReplica(replica: ReplicaId, node: Node<T, AccT>, len: number): void {
		this.stateVector[replica] ??= 0;
		const clock = this.stateVector[replica];
		this.stateVector[replica] += len;

		this.replicas[replica] ??= new BTree((ctx, key) => {});
		this.replicas[replica].set(clock, { node, offset: 0 });
		if (this.lastReplica !== replica) {
		}
		this.lastReplica = replica;
	}

	push(replica: ReplicaId, op: Op<T, AccT>, parents = this.leaves, parentOffsets?: number[]): boolean {
		// continuing last run?
		if (parents.length === 1) {
			const parent = parents[0];
			if (this.leaves.includes(parents[0])) {
				const len = opLength(op);
				parent.ops.push(op, len);
				this.setReplica(replica, parent, len);
				return true;
			}
		}
		// parents pointing to middle of existing nodes?
		parents = parents.map((p, i) => this.maybeSplit(p, parentOffsets?.[i]));
		// new node!
		this.leaves = this.leaves.filter(l => !parents.includes(l));
		const node = { ops: this.newRle(op), parents, children: [] };
		this.leaves.push(node);
		this.setReplica(replica, node, node.ops.count);

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
		return false;
	}

	insert(replica: ReplicaId, pos: number, item: AccT) {
		this.push(replica, { type: "insertion", pos, item });
	}

	delete(replica: ReplicaId, pos: number, count = 1) {
		this.push(replica, { type: "deletion", pos, count });
	}

	*climb(
		n: Node<T, AccT>,
		ctx = { map: new WeakMap(), count: 0 },
	): Generator<Node<T, AccT>> {
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
				.join(" ");
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

import { Graph, type AbsNodeRef } from "./graph";
import type { Accumulator, Deletion, Op, OpId, ReplicaId } from "./op";
import type { StateVector } from "./patch";
import { Replica } from "./replica";

/** An append-only list of immutable operations */
export class OpLog<T, AccT extends Accumulator<T> = T[]> {
	replicas: Record<ReplicaId, Replica<T, AccT>> = {};
	graph = new Graph();

	/** @param mergeFn How to merge runs together. */
	constructor(private mergeFn: (acc: AccT, cur: AccT) => AccT) {}

	push(
		replica: ReplicaId,
		op: Op<T, AccT>,
		parents?: AbsNodeRef[],
	): void {
		this.replicas[replica] ??= new Replica(this.mergeFn);
		const log = this.replicas[replica];
		const id: OpId = { replica, clock: log.count };
		log.push(op);
		const length = log.count - id.clock;
		this.graph.insert({ ...id, length }, parents);
	}



	//merge(src: OpLog<T, AccT>) {
	//	new Patch(src, this.stateVector).apply(this);
	//}
}

//type DebugRow<T, AccT extends Accumulator<T>> = {
//	id: string;
//	op: Op<T, AccT>;
//	parents: OpId[];
//};
//export function debugRows<T, AccT extends Accumulator<T>>(
//	oplog: OpLog<T, AccT>,
//): DebugRow<T, AccT>[] {
//	const res: DebugRow<T, AccT>[] = [];
//	for (let i = 0; i < oplog.ops.items.length; i++) {
//		const run = oplog.at(i);
//		res.push({
//			id: `${run.replica}${run.clock}`,
//			op: run.data,
//			parents: oplog.parentsAt(refEncode(i)).map(refDecode),
//		});
//	}
//	return res;
//}
//
//type DebugRow2<T, AccT extends Accumulator<T>> = [
//	id: string,
//	op: Op<T, AccT>,
//	parents: OpId[],
//];
//export function debugRows2<T, AccT extends Accumulator<T>>(
//	oplog: OpLog<T, AccT>,
//): DebugRow2<T, AccT>[] {
//	const res: DebugRow2<T, AccT>[] = [];
//	for (const row of debugRows(oplog)) {
//		res.push([ row.id, row.op, row.parents ]);
//	}
//	return res;
//}
//
//export function debugPrint(oplog: OpLog<any, any>): void {
//	const rows = debugRows(oplog);
//	console.table(rows);
//}
//
//export function toDot(oplog: OpLog<any, any>): string {
//	let res = `digraph { node[shape=rect] edge[dir=back]
//`;
//
//	const rows = debugRows(oplog);
//	for (let i = 0; i < rows.length; i++) {
//		const row = rows[i];
//		res += `${row.id}[label="${row.id}\\n${JSON.stringify(row.op.type, null, 2)}"`;
//		if (!row.parents.length) res += ',shape="Msquare"';
//		res += "]\n";
//		row.parents.forEach((pref) => {
//			const [idx, offset] = pref;
//			const parent = rows[idx];
//
//			res += `${parent.id} -> ${row.id}`;
//			if (offset !== oplog.ops.len(idx) - 1) res += `[label="${offset}"]`;
//			res += "\n";
//		});
//	}
//
//	return `${res}}`;
//}

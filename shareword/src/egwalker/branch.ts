import { advanceFrontier, type OpLog } from "./oplog";
import { Crdt, State, type Item } from "./crdt";
import type { Snapshot } from "./snapshot";
import { PriorityQueue } from "./util/pq";
import { refDecode, refEncode, type Accumulator, type OpRef } from "./op";

export class Branch<T, AccT extends Accumulator<T>> {
	frontier: OpRef[] = [];

	constructor(public oplog: OpLog<T, AccT>) {}

	checkout(mergeFrontier: OpRef[], snapshot?: Snapshot<T>) {
		const { head, shared, destOnly } = findHead(
			(ref) => this.oplog.parentsAt(ref),
			this.frontier,
			mergeFrontier,
		);
		//debugPrint(this.oplog);
		console.log("checkout");
		console.log(this.frontier.map((r) => refDecode(r).toString()));
		console.log(mergeFrontier.map((r) => refDecode(r).toString()));
		console.log(decodeDiff({ head, shared, destOnly }));

		const doc = new Crdt(this.oplog);
		doc.currentVersion = head;

		// TODO: single placeholder run with long length
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

		const [sharedStartIdx, sharedStartOffset] = refDecode(shared.start);
		const [sharedEndIdx, sharedEndOffset] = refDecode(shared.end);
		for (let i = sharedStartIdx; i <= sharedEndIdx; i++) {
			const startOffset = i === sharedStartOffset ? sharedStartOffset : 0;
			const endOffset = i === sharedEndIdx ? sharedEndOffset + 1 : this.oplog.ops.len(i);
			doc.applyOpRun(i, startOffset, endOffset);
		}

		const [destOnlyStartIdx, destOnlyStartOffset] = refDecode(destOnly.start);
		const [destOnlyEndIdx, destOnlyEndOffset] = refDecode(destOnly.end);
		for (let i = destOnlyStartIdx; i <= destOnlyEndIdx; i++) {
			const startOffset = i === destOnlyStartOffset ? destOnlyStartOffset : 0;
			const endOffset = i === destOnlyEndIdx ? destOnlyEndOffset + 1 : this.oplog.ops.len(i);
			doc.applyOpRun(i, startOffset, endOffset, snapshot);

			const ref = refEncode(i, endOffset);
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

export type OpRange = {
	start: OpRef;
	end: OpRef;
};
export type DiffResult = {
	head: OpRef[];
	shared: OpRange;
	destOnly: OpRange;
};

// There's a lot of complexity here.
//
// 1. Nodes point to parents, so graph traversal is backwards.
// As far as I can tell, this means we have to visit EVERY part of EVERY run
// since there might be a parent that points partway into a run.
//
// This also means
// that we have
export function findHead(
	getParents: (ref: OpRef) => OpRef[],
	src: OpRef[],
	dest: OpRef[],
): DiffResult {
	type MergePoint = {
		refs: OpRef[];
		inSrc: boolean;
	};

	const queue = new PriorityQueue<MergePoint>((a, b) =>
		cmpClocks(b.refs, a.refs),
	);

	const enq = (refs: OpRef[], inSrc: boolean) => {
		queue.push({
			refs: refs.toSorted((a, b) => b - a), // TODO: optimize
			inSrc,
		});
	};

	enq(src, true);
	enq(dest, false);

	let head: OpRef[] = [];
	const shared: OpRange = {
		start: Number.POSITIVE_INFINITY,
		end: Number.NEGATIVE_INFINITY,
	};
	const destOnly = { ...shared };

	let next: MergePoint | undefined;
	while ((next = queue.pop())) {
		if (!next.refs.length) {
			//console.log("root", next, queue, shared, bOnly);
			break;
		}
		let inSrc = next.inSrc;

		let peek: MergePoint | undefined;
		// multiple elements may have same merge point
		while ((peek = queue.peek())) {
			if (cmpClocks(next.refs, peek.refs)) break;

			if (peek.inSrc) inSrc = true;
			queue.pop();
		}

		if (!queue.length) {
			head = next.refs;
			break;
		}

		if (next.refs.length > 1) {
			for (const ref of next.refs) enq([ref], inSrc);
		} else {
			const [ref] = next.refs;
			// TODO: optimize
			if (inSrc) {
				shared.start = Math.min(shared.start, ref);
				shared.end = Math.max(shared.end, ref);
			} else {
				destOnly.start = Math.min(destOnly.start, ref);
				destOnly.end = Math.max(destOnly.end, ref);
			}

			enq(getParents(ref), inSrc);
		}
	}

	return { head: head.reverse(), shared, destOnly };
}

type LongRef = ReturnType<typeof refDecode>;
type LongOpRange = {
	start: LongRef;
	end: LongRef;
};
type LongDiffResult = {
	head: LongRef[];
	shared: LongOpRange;
	destOnly: LongOpRange;
};
/** For debugging */
export function decodeDiff(d: DiffResult): LongDiffResult {
	return {
		head: d.head.map(refDecode),
		shared: { start: refDecode(d.shared.start), end: refDecode(d.shared.end) },
		destOnly: {
			start: refDecode(d.destOnly.start),
			end: refDecode(d.destOnly.end),
		},
	};
}

import PriorityQueue from "./pq";
import { RleList } from "./util/rle-list";

/** A collaborating agent */
export type Site = string;
/** Non-negative integer incremented after each operation */
export type Clock = number;
/** Clock local to this */
export type LocalClock = Clock;
/** Each UTF-16 code unit is assigned this */
export type Id = { site: Site; clock: Clock };

export type Op<T> = {
	pos: number;
	delCount: number;
	content: T;
	id: Id;
	parents: LocalClock[];
};

export function advanceFrontier(
	frontier: Clock[],
	clock: Clock,
	parents: Clock[],
): Clock[] {
	const f = frontier.filter((v) => !parents.includes(v));
	f.push(clock);
	return f.sort((a, b) => a - b);
}

function idxCmp<T>(a: Op<T> & { index: number }, b: number) {
	return a.index - b;
}

export function tryAppendOp<T extends string>(
	prev: Op<T>,
	cur: Op<T>,
): boolean {
	const prevLength = prev.delCount || prev.content.length;

	if (
		prev.id.site !== cur.id.site ||
		prev.id.clock + prevLength !== cur.id.clock ||
		cur.parents.length !== 1 ||
		(prev.parents[0] ?? -1) + prevLength !== cur.parents[0]
	)
		return false;

	if (!prev.delCount && !cur.delCount && prev.pos + prevLength === cur.pos) {
		// @ts-ignore
		prev.content += cur.content;
		return true;
	}

	if (prev.delCount && cur.delCount && prev.pos === cur.pos) {
		prev.delCount += cur.delCount;
		return true;
	}

	return false;
}

/** An append-only list of immutable operations, similar to Git */
export class OpLog<T> {
	//ops = new RleList<Op<T> & { index: number }>();
	ops: Op<T>[] = [];
	/** Leaf nodes */
	frontier: Clock[] = [];
	/** Max known clock for each site. */
	stateVector: Record<Site, Clock> = {};
	/** Allows storing ops in a columnar fashion */
	emptyElement: T;

	constructor(emptyElement: T) {
		this.emptyElement = emptyElement;
	}

	//if (lc < 0) throw "invalid clock";
	//let idx = this.ops.findIndex(lc, (op, needle) => {
	//	if (needle < op.index) return 1;
	//	if (needle >= op.index + op.content.length) return -1;
	//	return 0;
	//});
	//if (idx < 0) idx = ~idx;
	//
	//const op = this.ops.items[idx];
	//const offset = lc - op.index;
	//
	//let parents: Clock[] = [];
	//if (offset !== 0) {
	//	parents = [(op.parents[0] ?? -1) + op.index + offset];
	//}
	//
	//const res = {
	//	id: {
	//		site: op.id.site,
	//		clock: op.id.clock + offset,
	//	},
	//	parents,
	//	pos: op.pos + offset,
	//	delCount: op.delCount ? 1 : 0,
	//	content: op.content[offset],
	//};
	////console.log("uh oh", clock, idx, offset, op, res);
	//// @ts-ignore
	//return res;

	getSite(lc: LocalClock): Site {
		return this.ops[lc].id.site;
	}

	getClock(lc: LocalClock): Clock {
		return this.ops[lc].id.clock;
	}

	getContent(lc: LocalClock): T {
		return this.ops[lc].content;
	}

	getDeleteCount(lc: LocalClock): number {
		return this.ops[lc].delCount;
	}

	getParents(lc: LocalClock): LocalClock[] {
		return this.ops[lc].parents;
	}

	getPos(lc: LocalClock): number {
		return this.ops[lc].pos;
	}

	nextClock(content?: T) {
		const len = Math.max(1, content?.length ?? 0);
		return this.ops.length + len - 2;
	}

	#pushLocal(site: Site, pos: number, delCount: number, content: T) {
		const clock = (this.stateVector[site] ?? -1) + 1;

		this.ops.push({
			pos,
			delCount,
			content,
			id: { site, clock },
			parents: this.frontier,
		});
		//		index: this.ops.length,
		//	},
		//	tryAppendOp,
		//);
		this.frontier = [this.nextClock(content)];
		this.stateVector[site] = clock;
	}

	insert(site: Site, pos: number, ...items: T[]) {
		for (const i of items) this.#pushLocal(site, pos++, 0, i);
	}

	delete(site: Site, pos: number, delCount: number) {
		for (let i = 0; i < delCount; i++)
			this.#pushLocal(site, pos, 1, this.emptyElement);
	}

	merge(src: OpLog<T>) {
		for (const op of src.ops) {
			const { site, clock } = op.id;
			const lastClock = this.stateVector[site] ?? -1;
			if (lastClock >= clock) continue;

			const parents = op.parents
				.map((lc) => {
					const site = src.getSite(lc);
					const clock = src.getClock(lc);

					return this.ops.findLastIndex(
						(op) => op.id.site === site && op.id.clock === clock,
					);
					//const idx = this.ops.items.findLastIndex(
					//	(op) =>
					//		id.site === op.id.site &&
					//		id.clock >= op.id.clock &&
					//		id.clock < op.id.clock + op.content.length,
					//);
					//if (idx < 0) {
					//	console.table(this.ops.items);
					//	throw `Id (${id.site},${id.clock}) does not exist`;
					//}
					//const op = this.ops.items[idx];
					//
					//return op.index + (id.clock - op.id.clock);
				})
				.sort((a, b) => a - b);

			this.ops.push({
				...op,
				parents,
			});
			//		index: this.ops.length,
			//	},
			//	tryAppendOp,
			//);
			this.frontier = advanceFrontier(
				this.frontier,
				this.nextClock(op.content),
				parents,
			);
			//assert(clock == lastKnownSeq + 1);
			this.stateVector[site] = clock + op.content.length - 1;
		}
	}

	diff(a: Clock[], b: Clock[]): { aOnly: Clock[]; bOnly: Clock[] } {
		type DiffFlag = "a" | "b" | "both";
		const flags: { [clock: Clock]: DiffFlag } = {};

		let numShared = 0;

		const queue = new PriorityQueue<Clock>((a, b) => b - a);

		function enq(v: Clock, flag: DiffFlag) {
			const oldFlag = flags[v];
			if (oldFlag == null) {
				queue.push(v);
				flags[v] = flag;
				if (flag === "both") numShared++;
			} else if (flag !== oldFlag && oldFlag !== "both") {
				flags[v] = "both";
				numShared++;
			}
		}

		for (const aa of a) enq(aa, "a");
		for (const bb of b) enq(bb, "b");

		const aOnly: Clock[] = [];
		const bOnly: Clock[] = [];

		while (queue.size() > numShared) {
			// biome-ignore lint/style/noNonNullAssertion: size check above
			const clock = queue.pop()!;
			const flag = flags[clock];

			if (flag === "a") aOnly.push(clock);
			else if (flag === "b") bOnly.push(clock);
			else numShared--;

			for (const p of this.getParents(clock)) enq(p, flag);
		}

		return { aOnly, bOnly };
	}

	diff2(
		a: Clock[],
		b: Clock[],
	): {
		head: Clock[];
		shared: Clock[];
		bOnly: Clock[];
	} {
		type MergePoint = {
			clocks: LocalClock[];
			inA: boolean;
		};

		const queue = new PriorityQueue<MergePoint>((a, b) =>
			cmpClocks(b.clocks, a.clocks),
		);

		const enq = (localClocks: LocalClock[], inA: boolean) => {
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

			if (queue.isEmpty()) {
				head = next.clocks.reverse();
				break;
			}

			if (next.clocks.length >= 2) {
				for (const lc of next.clocks) enq([lc], inA);
			} else {
				const lc = next.clocks[0];
				//assert(v.length == 1);
				if (inA) shared.push(lc);
				else bOnly.push(lc);

				enq(this.getParents(lc), inA);
			}
		}

		return {
			head,
			shared: shared.reverse(),
			bOnly: bOnly.reverse(),
		};
	}
}

function cmpClocks(a: Clock[], b: Clock[]): number {
	for (let i = 0; i < a.length; i++) {
		if (b.length <= i) return 1;

		const delta = a[i] - b[i];
		if (delta !== 0) return delta;
	}

	if (a.length < b.length) return -1;
	return 0;
}

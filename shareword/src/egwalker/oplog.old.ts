import { EgWalker } from "./egwalker";
import PriorityQueue from "./util/pq";

/** A collaborating agent */
export type Site = string;
/** Non-negative integer incremented after each operation */
export type Clock = number;
export type LocalClock = number;
function compareClocks(a: LocalClock[], b: LocalClock[]): number {
	for (let i = 0; i < a.length; i++) {
		if (b.length <= i) return 1;

		const delta = a[i] - b[i];
		if (delta !== 0) return delta;
	}

	if (a.length < b.length) return -1;
	return 0;
}

/** Each UTF-16 code unit is assigned this */
export type Id = { site: Site; clock: Clock };
const idEq = (a: Id, b: Id) => a.site === b.site && a.clock === b.clock;

export type Op<T> = {
	pos: number;
	delCount: number;
	content: T;
	site: Site;
	clock: Clock;
	parents: Clock[];
};

/** An append-only list of immutable operations, similar to Git */
export class OpLog<T> {
	ops: Op<T>[] = [];
	/** Leaf nodes */
	frontier: Clock[] = [];
	/** Latest clock value for each site. */
	stateVector: Record<Site, number> = {};
	/** Allows storing ops in a columnar fashion */
	emptyElement: T;

	constructor(emptyElement: T) {
		this.emptyElement = emptyElement;
	}

	get(clock: LocalClock): Op<T> {
		return this.ops[clock];
	}

	#pushLocal(site: string, pos: number, delCount: number, content: T) {
		const clock = (this.stateVector[site] ?? -1) + 1;

		this.ops.push({
			pos,
			delCount,
			content,
			site,
			clock,
			parents: this.frontier,
		});
		this.frontier = [this.ops.length - 1];
		this.stateVector[site] = clock;
	}

	nextClock() {
		return this.ops.length;
	}

	#pushRemote(op: Op<T>, parentIds: Id[]) {
		const site = op.site;
		const clock = op.clock;
		const lastKnownSeq = this.stateVector[site] ?? -1;
		if (lastKnownSeq >= clock) return;

		const parents = parentIds
			.map((id) =>
				this.ops.findIndex((op) =>
					idEq({ site: op.site, clock: op.clock }, id),
				),
			)
			.sort((a, b) => a - b);

		this.ops.push({ ...op, parents });
		this.frontier = advanceFrontier(
			this.frontier,
			this.ops.length - 1,
			parents,
		);
		//assert(clock == lastKnownSeq + 1);
		this.stateVector[site] = clock;
	}

	insert(site: string, pos: number, ...content: T[]) {
		for (const c of content) this.#pushLocal(site, pos++, 0, c);
	}

	delete(site: string, pos: number, delCount: number) {
		for (let i = 0; i < delCount; i++)
			this.#pushLocal(site, pos, 1, this.emptyElement);
	}

	merge(src: OpLog<T>) {
		for (const op of src.ops) {
			const parentIds = op.parents.map((clock) => src.getId(clock));
			this.#pushRemote(op, parentIds);
		}
	}

	getId(c: Clock) {
		return { site: this.ops[c].site, clock: this.ops[c].clock };
	}

	getPos(c: Clock) {
		return this.ops[c].pos;
	}

	getDeleted(c: Clock) {
		return this.ops[c].delCount > 0;
	}

	getParents(c: Clock) {
		return this.ops[c].parents;
	}

	getContent(c: Clock) {
		return this.ops[c].content;
	}

	diff(a: Clock[], b: Clock[]): { aOnly: Clock[]; bOnly: Clock[] } {
		type DiffFlag = "a" | "b" | "both";
		const flags = new Map<Clock, DiffFlag>();

		let numShared = 0;

		const queue = new PriorityQueue<Clock>((a, b) => b - a);

		function enq(v: Clock, flag: DiffFlag) {
			// Queue v, with the specified flag.
			const oldFlag = flags.get(v);
			if (oldFlag == null) {
				queue.push(v);
				flags.set(v, flag);
				if (flag === "both") numShared++;
			} else if (flag !== oldFlag && oldFlag !== "both") {
				flags.set(v, "both");
				numShared++;
			}
		}

		for (const aa of a) enq(aa, "a");
		for (const bb of b) enq(bb, "b");

		const aOnly: Clock[] = [];
		const bOnly: Clock[] = [];

		while (queue.size() > numShared) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const clock = queue.pop()!;
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const flag = flags.get(clock)!;

			if (flag === "a") aOnly.push(clock);
			else if (flag === "b") bOnly.push(clock);
			else numShared--;

			const op = this.ops[clock];
			for (const p of op.parents) enq(p, flag);
		}

		return { aOnly, bOnly };
	}

	diff2(
		a: LocalClock[],
		b: LocalClock[],
	): {
		head: LocalClock[];
		shared: LocalClock[];
		bOnly: LocalClock[];
	} {
		//console.log("findOpsToVisit", a, b);
		type MergePoint = {
			localClocks: LocalClock[]; // Sorted in inverse order (highest to lowest)
			isInA: boolean;
		};

		const queue = new PriorityQueue<MergePoint>((a, b) =>
			compareClocks(b.localClocks, a.localClocks),
		);

		const enq = (localClocks: LocalClock[], isInA: boolean) => {
			queue.push({
				localClocks: localClocks.toSorted((a, b) => b - a),
				isInA,
			});
		};

		enq(a, true);
		enq(b, false);

		let head: LocalClock[];
		const shared = [];
		const bOnly = [];

		while (true) {
			// biome-ignore lint/style/noNonNullAssertion: at least 2 items pushed
			let { localClocks, isInA } = queue.pop()!;
			if (localClocks.length === 0) {
				head = [];
				break;
			}

			while (!queue.isEmpty()) {
				// We might have multiple elements that have the same merge point.
				// biome-ignore lint/style/noNonNullAssertion: <explanation>
				const { localClocks: peekV, isInA: peekIsInA } = queue.peek()!;
				if (compareClocks(localClocks, peekV) !== 0) break;

				queue.pop();
				if (peekIsInA) isInA = true;
			}

			if (queue.isEmpty()) {
				head = localClocks.reverse();
				break;
			}

			if (localClocks.length >= 2) {
				for (const vv of localClocks) enq([vv], isInA);
			} else {
				const lc = localClocks[0];
				//assert(v.length == 1);
				if (isInA) shared.push(lc);
				else bOnly.push(lc);

				const op = this.get(lc);
				//console.log(op.content, op.parents);
				enq(op.parents, isInA);
			}
		}

		return {
			head,
			shared: shared.reverse(),
			bOnly: bOnly.reverse(),
		};
	}

	checkout(): T[] {
		const doc = new EgWalker();
		const res: T[] = [];

		for (let clock = 0; clock < this.ops.length; clock++)
			doc.doOp(this, clock, res);

		return res;
	}
}

export function advanceFrontier(
	frontier: Clock[],
	clock: Clock,
	parents: Clock[],
): Clock[] {
	const f = frontier.filter((v) => !parents.includes(v));
	f.push(clock);
	return f.sort((a, b) => a - b);
}

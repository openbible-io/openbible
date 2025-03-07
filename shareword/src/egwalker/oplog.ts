import PriorityQueue from "./pq";

/** A collaborating agent */
export type Site = string;
/** Non-negative integer incremented after each operation */
export type Clock = number;
/** Clock local to this */
export type LocalClock = Clock;
/** Each UTF-16 code unit is assigned this */
export type Id = { site: Site; clock: Clock };
const idEq = (a: Id, b: Id) => a.site === b.site && a.clock === b.clock;

export type Op<T> = {
	pos: number;
	delCount: number;
	content: T;
	id: Id;
	parents: Clock[];
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

/** An append-only list of immutable operations, similar to Git */
export class OpLog<T> {
	#ops: Op<T>[] = [];
	/** Leaf nodes */
	frontier: Clock[] = [];
	/** Max known clock for each site. */
	stateVector: Record<Site, Clock> = {};
	/** Allows storing ops in a columnar fashion */
	emptyElement: T;

	constructor(emptyElement: T) {
		this.emptyElement = emptyElement;
	}

	get(localClock: LocalClock): Op<T> {
		return this.#ops[localClock];
	}

	#pushLocal(site: Site, pos: number, delCount: number, content: T) {
		const clock = (this.stateVector[site] ?? -1) + 1;

		this.#ops.push({
			pos,
			delCount,
			content,
			id: { site, clock },
			parents: this.frontier,
		});
		this.frontier = [this.#ops.length - 1];
		this.stateVector[site] = clock;
	}

	#pushRemote(op: Op<T>, parentIds: Id[]) {
		const { site, clock } = op.id;
		const lastClock = this.stateVector[site] ?? -1;
		if (lastClock >= clock) return;

		const parents = parentIds
			.map((id) => this.#ops.findIndex((op) => idEq(op.id, id)))
			.sort((a, b) => a - b);

		this.#ops.push({ ...op, parents });
		this.frontier = advanceFrontier(
			this.frontier,
			this.#ops.length - 1,
			parents,
		);
		//assert(clock == lastKnownSeq + 1);
		this.stateVector[site] = clock;
	}

	insert(site: Site, pos: number, ...items: T[]) {
		for (const c of items) this.#pushLocal(site, pos++, 0, c);
	}

	delete(site: Site, pos: number, delCount: number) {
		for (let i = 0; i < delCount; i++)
			this.#pushLocal(site, pos, 1, this.emptyElement);
	}

	merge(src: OpLog<T>) {
		for (const op of src.#ops) {
			const parentIds = op.parents.map((clock) => src.#ops[clock].id);
			this.#pushRemote(op, parentIds);
		}
	}

	diff(a: Clock[], b: Clock[]): { aOnly: Clock[]; bOnly: Clock[] } {
		type DiffFlag = "a" | "b" | "both";
		const flags: { [clock: Clock] : DiffFlag } = {};

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

			const op = this.#ops[clock];
			for (const p of op.parents) enq(p, flag);
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

				const op = this.get(lc);
				enq(op.parents, inA);
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

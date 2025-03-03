import PriorityQueue from "./pq";
/** A collaborating agent. */
export type Site = string;
/** Non-negative integer incremented after each operation */
export type Clock = number;
/** Each UTF-16 code unit is assigned this. */
export type Id = { site: Site; clock: Clock };

const idEq = (a: Id, b: Id) => a.site === b.site && a.clock === b.clock;

type OpInner<T> =
	| {
			type: "ins";
			content: T;
			pos: number;
	  }
	| {
			type: "del";
			pos: number;
	  };

export type Op<T> = OpInner<T> & {
	id: Id;
	parents: Clock[];
};

/** Latest clock value for each site. */
type StateVector = Record<Site, number>;

type DiffResult = { aOnly: Clock[]; bOnly: Clock[] };

export function advanceFrontier(
	frontier: Clock[],
	lv: Clock,
	parents: Clock[],
): Clock[] {
	const f = frontier.filter((v) => !parents.includes(v));
	f.push(lv);
	return f.sort((a, b) => a - b);
}

export class OpLog<T> {
	ops: Op<T>[] = [];
	/** Leaf nodes */
	frontier: Clock[] = [];
	version: StateVector = {};

	pushLocalOp(agent: string, op: OpInner<T>) {
		const seq = (this.version[agent] ?? -1) + 1;

		const lv = this.ops.length;
		this.ops.push({
			...op,
			id: { site: agent, clock: seq },
			parents: this.frontier,
		});

		this.frontier = [lv];
		this.version[agent] = seq;
	}

	localInsert(agent: string, pos: number, content: T[]) {
		for (const c of content) {
			this.pushLocalOp(agent, {
				type: "ins",
				content: c,
				pos,
			});
			pos++;
		}
	}

	localDelete(agent: string, pos: number, delLen: number) {
		while (delLen > 0) {
			this.pushLocalOp(agent, {
				type: "del",
				pos,
			});
			delLen--;
		}
	}

	idToLV(id: Id): Clock {
		const idx = this.ops.findIndex((op) => idEq(op.id, id));
		if (idx < 0) throw Error("Could not find id in oplog");
		return idx;
	}

	pushRemoteOp(op: Op<T>, parentIds: Id[]) {
		const { site: agent, clock: seq } = op.id;
		const lastKnownSeq = this.version[agent] ?? -1;
		if (lastKnownSeq >= seq) return; // We already have the op.

		const lv = this.ops.length;
		const parents = parentIds
			.map((id) => this.idToLV(id))
			.sort((a, b) => a - b);

		this.ops.push({
			...op,
			parents,
		});

		this.frontier = advanceFrontier(this.frontier, lv, parents);
		if (seq !== lastKnownSeq + 1) throw Error("Seq numbers out of order");
		this.version[agent] = seq;
	}

	advanceFrontier(lv: Clock, parents: Clock[]): void {
		this.frontier = this.frontier.filter((v) => !parents.includes(v));
		this.frontier.push(lv);
		this.frontier.sort((a, b) => a - b);
	}

	mergeInto(src: OpLog<T>) {
		for (const op of src.ops) {
			const parentIds = op.parents.map((lv) => src.ops[lv].id);
			this.pushRemoteOp(op, parentIds);
		}
	}

	diff(a: Clock[], b: Clock[]): DiffResult {
		type DiffFlag = 'a' | 'b' | 'both';
		const flags = new Map<Clock, DiffFlag>();

		let numShared = 0;

		const queue = new PriorityQueue<Clock>((a, b) => b - a);

		function enq(v: Clock, flag: DiffFlag) {
			// Queue v, with the specified flag.
			const oldFlag = flags.get(v);
			if (oldFlag == null) {
				queue.push(v);
				flags.set(v, flag);
				if (flag === 'both') numShared++;
			} else if (flag !== oldFlag && oldFlag !== 'both') {
				flags.set(v, 'both');
				numShared++;
			}
		}

		for (const aa of a) enq(aa, 'a');
		for (const bb of b) enq(bb, 'b');

		const aOnly: Clock[] = [];
		const bOnly: Clock[] = [];

		while (queue.size() > numShared) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const lv = queue.pop()!;
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			const flag = flags.get(lv)!;

			if (flag === 'a') aOnly.push(lv);
			else if (flag === 'b') bOnly.push(lv);
			else numShared--;

			const op = this.ops[lv];
			for (const p of op.parents) enq(p, flag);
		}

		return { aOnly, bOnly };
	}
}

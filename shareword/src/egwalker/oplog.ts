import { EgWalker } from "./egwalker";
import PriorityQueue from "./pq";

/** A collaborating agent */
export type Site = string;
/** Non-negative integer incremented after each operation */
export type Clock = number;
/** Each UTF-16 code unit is assigned this */
export type Id = { site: Site; clock: Clock };

/** An append-only list of immutable operations, similar to Git */
export class OpLog<T> {
	/** Leaf nodes */
	frontier: Clock[] = [];
	/** Latest clock value for each site. */
	version: Record<Site, number> = {};
	/** Allows storing ops in a columnar fashion */
	emptyElement: T;

	sites: Site[] = [];
	clocks: Clock[] = [];
	parents: Clock[][] = [];
	positions: number[] = [];
	deleteCounts: number[] = [];
	items: T[] = [];

	constructor(emptyElement: T) {
		this.emptyElement = emptyElement;
	}

	getSite(clock: Clock): Site {
		return this.sites[clock];
	}

	getParents(clock: Clock): Clock[] {
		return this.parents[clock];
	}

	getPosition(clock: Clock): number {
		return this.positions[clock];
	}

	getDeleteCount(clock: Clock): number {
		return this.deleteCounts[clock];
	}

	getItem(clock: Clock): T {
		return this.items[clock];
	}

	#pushLocal(site: string, pos: number, deleteCount: number, content: T) {
		const clock = (this.version[site] ?? -1) + 1;

		this.sites.push(site);
		this.clocks.push(clock);
		this.parents.push(this.frontier);
		this.positions.push(pos);
		this.deleteCounts.push(deleteCount);
		this.items.push(content);
		this.frontier = [this.clocks.length - 1];
		this.version[site] = clock;
	}

	#pushRemote(
		site: string,
		clock: Clock,
		pos: number,
		deleteCount: number,
		content: T,
		parentSites: Site[],
		parentClocks: Clock[],
	) {
		const lastKnownSeq = this.version[site] ?? -1;
		if (lastKnownSeq >= clock) return;

		const parents = [];
		// assert(parentSites.length == parentSites.length);
		for (let i = 0; i < parentSites.length; i++) {
			for (let j = 0; j < this.sites.length; j++) {
				if (
					parentSites[i] === this.sites[j] &&
					parentClocks[i] === this.clocks[j]
				)
					parents.push(j);
			}
		}
		parents.sort((a, b) => a - b);

		this.sites.push(site);
		this.clocks.push(clock);
		this.parents.push(parents);
		this.positions.push(pos);
		this.deleteCounts.push(deleteCount);
		this.items.push(content);
		this.frontier = advanceFrontier(
			this.frontier,
			this.clocks.length - 1,
			parents,
		);
		//assert(clock == lastKnownSeq + 1);
		this.version[site] = clock;
	}

	insert(site: string, pos: number, content: T[]) {
		for (const c of content) this.#pushLocal(site, pos++, 0, c);
	}

	delete(site: string, pos: number, deleteCount: number) {
		for (let i = 0; i < deleteCount; i++)
			this.#pushLocal(site, pos, 1, this.emptyElement);
	}

	merge(src: OpLog<T>) {
		for (let i = 0; i < src.parents.length; i++) {
			this.#pushRemote(
				src.sites[i],
				src.clocks[i],
				src.positions[i],
				src.deleteCounts[i],
				src.items[i],
				src.parents[i].map((c) => src.sites[c]),
				src.parents[i].map((c) => src.clocks[c]),
			);
		}
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

			for (const p of this.parents[clock]) enq(p, flag);
		}

		return { aOnly, bOnly };
	}

	checkout(): T[] {
		const doc = new EgWalker();
		const res: T[] = [];

		for (let clock = 0; clock < this.clocks.length; clock++)
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

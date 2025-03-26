import { Branch } from "./egwalker/branch";
import { OpLog } from "./egwalker/oplog";
import type { Accumulator, Site } from "./egwalker/oplog-rle";
import { ListSnapshot, type Snapshot } from "./egwalker/snapshot";

export class GenericList<T, AccT extends Accumulator<T>> extends EventTarget {
	site: Site;
	oplog: OpLog<T, AccT>;
	branch: Branch<T, AccT>;

	constructor(
		site: Site,
		emptyItem: AccT,
		mergeFn: (acc: AccT, cur: AccT) => AccT,
		public snapshot: Snapshot<T>,
	) {
		super();
		this.site = site;
		this.oplog = new OpLog(emptyItem, mergeFn);
		this.branch = new Branch();
	}

	append(pos: number, items: AccT, updateSnapshot = true): void {
		if (items.length <= 0) return;

		this.oplog.insert(this.site, pos, items);
		if (updateSnapshot) this.snapshot.insert(pos, items);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	delete(pos: number, delLen = 1, updateSnapshot = true) {
		if (delLen <= 0) return;

		this.oplog.delete(this.site, pos, delLen);
		if (updateSnapshot) this.snapshot.delete(pos, delLen);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	items(): AccT {
		let res = this.oplog.emptyItem.slice();
		for (const item of this.snapshot.items()) {
			// @ts-ignore idk and idc
			res = this.oplog.mergeFn(res, [item]);
		}
		return res;
	}

	merge(other: GenericList<T, AccT>) {
		this.oplog.merge(other.oplog);
		this.branch.checkout(this.oplog, this.oplog.frontier, this.snapshot);
		this.dispatchEvent(new CustomEvent("merge"));
	}
}

export class List<T> extends GenericList<T, T[]> {
	constructor(site: Site) {
		super(
			site,
			[],
			(acc, cur) => {
				acc.push(...cur);
				return acc;
			},
			new ListSnapshot(),
		);
	}

	insert(pos: number, updateSnapshot = true, ...items: T[]) {
		// Transform T to AccT
		this.append(pos, items, updateSnapshot);
	}
}

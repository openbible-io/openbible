import { Branch } from "./egwalker/branch";
import { OpLog } from "./egwalker/oplog";
import type { Accumulator, Site } from "./egwalker/oplog-rle";

export class GenericList<T, AccT extends Accumulator<T>> extends EventTarget {
	site: Site;
	oplog: OpLog<T, AccT>;
	branch: Branch<T, AccT>;

	constructor(
		site: Site,
		emptyItem: AccT,
		mergeFn: (acc: AccT, cur: AccT) => AccT,
	) {
		super();
		this.site = site;
		this.oplog = new OpLog(emptyItem, mergeFn);
		this.branch = new Branch();
	}

	append(pos: number, items: AccT): void {
		if (items.length <= 0) return;

		this.oplog.insert(this.site, pos, items);
		this.branch.insert(pos, items);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	delete(pos: number, delLen = 1) {
		if (delLen <= 0) return;

		this.oplog.delete(this.site, pos, delLen);
		this.branch.delete(pos, delLen);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	items(): AccT {
		let res = this.oplog.emptyItem.slice();
		for (const item of this.branch.items()) {
			// @ts-ignore idk and idc
			res = this.oplog.mergeFn(res, [item]);
		}
		return res;
	}

	merge(other: GenericList<T, AccT>) {
		this.oplog.merge(other.oplog);
		this.branch.checkout(this.oplog, this.oplog.frontier);
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
		);
	}

	insert(pos: number, ...items: T[]) {
		// Transform T to AccT
		this.append(pos, items);
	}
}

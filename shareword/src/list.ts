import { Branch } from "./egwalker/branch";
import { OpLog, type Site } from "./egwalker/oplog";

export class List<T> {
	site: Site;
	oplog = new OpLog<T, T[]>(
		(acc, ...others) => {
			const res = acc ?? []; 
			res.push(...others);
			return res;
		},
		(item, delCount) => item.length + delCount,
	);
	branch = new Branch<T>();

	constructor(site: Site) {
		this.site = site;
	}

	insert(pos: number, ...items: T[]) {
		this.oplog.insert(this.site, pos, ...items);
		this.branch.snapshot.splice(pos, 0, ...items);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	delete(pos: number, delLen = 1) {
		this.oplog.delete(this.site, pos, delLen);
		this.branch.snapshot.splice(pos, delLen);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	items() {
		return this.branch.snapshot;
	}

	merge(other: List<T>) {
		this.oplog.merge(other.oplog);
		this.branch.checkout(this.oplog);
	}
}

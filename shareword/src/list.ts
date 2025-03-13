import { Branch } from "./egwalker/branch";
import { OpLog, type Site } from "./egwalker/oplog";

export class List<T> {
	site: Site;
	oplog: OpLog<T>;
	branch = new Branch<T>();

	constructor(site: Site, emptyElement: T[]) {
		this.site = site;
		this.oplog = new OpLog<T>(
			emptyElement,
			(acc, cur) => {
				acc.push(...cur);
				return acc;
			},
		);
	}

	insert(pos: number, ...items: T[]) {
		this.oplog.insert(this.site, pos, items);
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

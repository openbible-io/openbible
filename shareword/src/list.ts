import { Branch } from "./egwalker/branch";
import { OpLog, type Site } from "./egwalker/oplog";

export class List<T> {
	oplog: OpLog<T>;
	site: Site;
	branch: Branch<T>;

	constructor(site: Site, emptyElement: T) {
		this.oplog = new OpLog(emptyElement);
		this.site = site;
		this.branch = new Branch();
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

	toString() {
		return this.branch.snapshot.join("");
	}

	items() {
		return this.branch.snapshot;
	}

	merge(other: List<T>) {
		this.oplog.merge(other.oplog);
		this.branch.checkoutFancy(this.oplog);
	}

	reset() {
		this.oplog = new OpLog(this.oplog.emptyElement);
		this.branch = new Branch();
	}
}


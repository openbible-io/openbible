import { Branch } from "./egwalker/branch";
import { OpLog, type Site } from "./egwalker/oplog";

export class Text {
	site: Site;

			//(items, cur) => {
			//	const curLen = cur.items.length + cur.deleteCount;
			//	return { curLen, appended: false };
			//},
	oplog = new OpLog<string, string>(
		(acc, ...others) => (acc ?? "") + others.join(""),
		(item, delCount) => item.length + delCount,
	);
	branch = new Branch<string>();

	constructor(site: Site) {
		this.site = site;
	}

	insert(pos: number, ...items: string[]) {
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

	merge(other: Text) {
		this.oplog.merge(other.oplog);
		this.branch.checkout(this.oplog);
	}
}

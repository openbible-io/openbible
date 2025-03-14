import { Branch } from "./egwalker/branch";
import { OpLog } from "./egwalker/oplog";
import type { Site } from "./egwalker/util/state-vector";

export class Text {
	site: Site;

	oplog = new OpLog<string, string>("", (acc, cur) => acc + cur);
	branch = new Branch<string, string>();

	constructor(site: Site) {
		this.site = site;
	}

	insert(pos: number, items: string) {
		if (items.length <= 0) return;

		this.oplog.insert(this.site, pos, items);
		this.branch.snapshot.splice(pos, 0, ...items);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	delete(pos: number, delLen = 1) {
		if (delLen <= 0) return;

		this.oplog.delete(this.site, pos, delLen);
		this.branch.snapshot.splice(pos, delLen);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	merge(other: Text) {
		this.oplog.merge(other.oplog);
		this.branch.checkout(this.oplog);
	}

	toString() {
		return this.branch.snapshot.join("");
	}
}

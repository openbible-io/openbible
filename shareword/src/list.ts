import { Branch } from "./egwalker/branch";
import { OpLog } from "./egwalker/oplog";

export class List<T> {
	oplog: OpLog<T>;
	agent: string;
	branch: Branch<T>;

	constructor(agent: string, emptyElement: T) {
		this.oplog = new OpLog(emptyElement);
		this.agent = agent;
		this.branch = new Branch();
	}

	check() {
		const actualDoc = this.oplog.checkout();
		if (actualDoc.join("") !== this.branch.snapshot.join(""))
			throw Error("Document out of sync");
	}

	insert(pos: number, ...items: T[]) {
		this.oplog.insert(this.agent, pos, ...items);
		this.branch.snapshot.splice(pos, 0, ...items);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	delete(pos: number, delLen = 1) {
		this.oplog.delete(this.agent, pos, delLen);
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


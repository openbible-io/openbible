import { Branch } from "./egwalker/branch";
import { OpLog } from "./egwalker/oplog";

export class Text {
	oplog: OpLog<string>;
	agent: string;
	branch: Branch<string>;

	constructor(agent: string) {
		this.oplog = new OpLog("");
		this.agent = agent;
		this.branch = new Branch();
	}

	check() {
		const actualDoc = this.oplog.checkout();
		if (actualDoc.join("") !== this.branch.snapshot.join(""))
			throw Error("Document out of sync");
	}

	insert(pos: number, text: string) {
		const inserted = [...text];
		this.oplog.insert(this.agent, pos, inserted);
		this.branch.snapshot.splice(pos, 0, ...inserted);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	delete(pos: number, delLen: number) {
		this.oplog.delete(this.agent, pos, delLen);
		// this.snapshot = checkout(this.oplog)
		this.branch.snapshot.splice(pos, delLen);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	toString() {
		return this.branch.snapshot.join("");
	}

	merge(other: Text) {
		this.oplog.merge(other.oplog);
		// this.snapshot = checkout(this.oplog)
		this.branch.checkoutFancy(this.oplog);
	}

	reset() {
		this.oplog = new OpLog("");
		this.branch = new Branch();
	}
}


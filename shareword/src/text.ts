import { Branch } from "./branch";
import { OpLog } from "./oplog";
import { EgWalker } from "./egwalker";

export class Text {
	oplog: OpLog<string>;
	agent: string;
	branch: Branch<string>;

	constructor(agent: string) {
		this.oplog = new OpLog();
		this.agent = agent;
		this.branch = new Branch();
	}

	check() {
		const actualDoc = checkout(this.oplog);
		if (actualDoc.join("") !== this.branch.snapshot.join(""))
			throw Error("Document out of sync");
	}

	ins(pos: number, text: string) {
		const inserted = [...text];
		this.oplog.localInsert(this.agent, pos, inserted);
		this.branch.snapshot.splice(pos, 0, ...inserted);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	del(pos: number, delLen: number) {
		this.oplog.localDelete(this.agent, pos, delLen);
		// this.snapshot = checkout(this.oplog)
		this.branch.snapshot.splice(pos, delLen);
		this.branch.frontier = this.oplog.frontier.slice();
	}

	getString() {
		// return checkout(this.oplog).join('')
		return this.branch.snapshot.join("");
	}

	mergeFrom(other: Text) {
		this.oplog.mergeInto(other.oplog);
		// this.snapshot = checkout(this.oplog)
		this.branch.checkoutFancy(this.oplog);
	}

	reset() {
		this.oplog = new OpLog();
		this.branch = new Branch();
	}
}

function checkout<T>(oplog: OpLog<T>): T[] {
	const doc = new EgWalker();
	const snapshot: T[] = [];

	for (let lv = 0; lv < oplog.ops.length; lv++) {
		doc.do1Operation(oplog, lv, snapshot);
	}

	return snapshot;
}

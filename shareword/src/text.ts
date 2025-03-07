import { List } from "./list";

export class Text extends List<string> {
	constructor(agent: string) {
		super(agent, "");
	}

	override insert(pos: number, text: string) {
		// Each character is an item
		this.oplog.insert(this.agent, pos, ...text);
		this.branch.snapshot.splice(pos, 0, ...text);
		this.branch.frontier = this.oplog.frontier.slice();
	}
}

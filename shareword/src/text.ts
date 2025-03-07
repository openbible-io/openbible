import type { Site } from "./egwalker/oplog";
import { List } from "./list";

export class Text extends List<string> {
	constructor(site: Site) {
		super(site, "");
	}

	override insert(pos: number, text: string) {
		// Each character is an item
		this.oplog.insert(this.site, pos, ...text);
		this.branch.snapshot.splice(pos, 0, ...text);
		this.branch.frontier = this.oplog.frontier.slice();
	}
}

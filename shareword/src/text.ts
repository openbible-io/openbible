import type { Site } from "./egwalker/oplog-rle";
import { ListSnapshot } from "./egwalker/snapshot";
import { GenericList } from "./list";

export class Text extends GenericList<string, string> {
	constructor(site: Site, snapshot = new ListSnapshot<string>()) {
		super(site, "", (acc, cur) => acc + cur, snapshot);
	}

	insert(pos: number, text: string) {
		this.append(pos, text);
	}

	toString(): string {
		return this.items();
	}
}

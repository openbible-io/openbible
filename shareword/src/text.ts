import type { Site } from "./egwalker/oplog-rle";
import { GenericList } from "./list";

export class Text extends GenericList<string, string> {
	constructor(site: Site) {
		super(site, "", (acc, cur) => acc + cur);
	}

	insert(pos: number, text: string) {
		this.append(pos, text);
	}

	toString() {
		return this.branch.data.join("");
	}
}

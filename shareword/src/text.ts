import List from "./list";

type Selection = { pos: number; len?: number };
type Utf16CodePoint = string;

/*
 * An append-only array of splice and selection events.
 *
 * Each position is a UTF-16 code-point that may be selected. It's up to
 * the editor to ensure that selections fall on grapheme boundaries or
 * this may store ill-formed UTF16.
 *
 * This supports multiple selections and does not normalize them. It's up
 * to the editor to ensure proper multi-selection behavior.
 */
export default class Text {
	list = new List<Utf16CodePoint>("");
	selections: Selection[];

	constructor(init = "") {
		this.insert(init);
		this.list.splice(0, 0);
		this.selections =  [{ pos: 0 }];
	}

	// TODO: combine overlap
	normalizeSelections(): void {
		this.selections = Object.values(
			Object.groupBy(this.selections, (s) => s.pos),
		)
			.filter((selections) => Array.isArray(selections))
			.map((selections) => selections[0])
			.sort((s1, s2) => s1.pos - s2.pos);
	}

	insert(text: string) {
		for (let i = 0; i < this.selections.length; i++) {
			const s = this.selections[i];
			if (s.len) this.list.delete(s.pos, s.len);
			for (let j = 0; j < text.length; j++) {
				this.list.insert(s.pos + j, text[j]);
			}
			s.pos += text.length * (this.selections.length - i);
			s.len = 0;
		}
		this.normalizeSelections();
	}

	delete(forwards = false) {
		const offset = forwards ? 0 : -1;
		for (let i = 0; i < this.selections.length; i++) {
			const s = this.selections[i];
			const pos = s.pos + offset;
			if (pos < 0) continue;

			const len = s.len || 1;
			this.list.delete(pos, len);
			s.pos -= len * (this.selections.length - i);
			s.len = 0;
		}
		this.normalizeSelections();
	}

	values(): string {
		return this.list.values().join("");
	}
}

type Id = [agent: string, seq: number];

type Item = {
	content: string; // char

	id: Id;
	originLeft: Id | null;
	originRight: Id | null;

	deleted: boolean;
};

type Version = { [key: string]: number };

type TypedEventTarget<EventMap extends object> = {
	new (): IntermediateEventTarget<EventMap>;
};

// internal helper type
interface IntermediateEventTarget<EventMap> extends EventTarget {
	addEventListener<K extends keyof EventMap>(
		type: K,
		callback: (
			event: EventMap[K] extends Event ? EventMap[K] : never,
		) => EventMap[K] extends Event ? void : never,
		options?: boolean | AddEventListenerOptions,
	): void;

	addEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: AddEventListenerOptions | boolean,
	): void;

	removeEventListener<K extends keyof EventMap>(
		type: K,
		callback: (
			event: EventMap[K] extends Event ? EventMap[K] : never,
		) => EventMap[K] extends Event ? void : never,
		options?: boolean | EventListenerOptions,
	): void;

	removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: EventListenerOptions | boolean,
	): void;
}

export class Doc extends (EventTarget as TypedEventTarget<{
	change: CustomEvent<void>;
}>) {
	content: Item[] = [];
	version: Version = {};
	cursor = 0;
	agent: string;

	constructor(agent: string) {
		super();
		this.agent = agent;
	}

	private findItem(pos: number, stickEnd = false): number {
		let i = 0;
		for (; i < this.content.length; i++) {
			const item = this.content[i];
			if (stickEnd && pos === 0) return i;
			if (item.deleted) continue;
			if (pos === 0) return i;

			pos--;
		}

		if (pos === 0) return i;
		throw Error(`past end of the document ${pos}`);
	}

	private insertOne(text: string, pos: number): void {
		const idx = this.findItem(pos, true);

		const seq = (this.version[this.agent] ?? -1) + 1;
		this.integrate({
			content: text,
			id: [this.agent, seq],
			deleted: false,
			originLeft: this.content[idx - 1]?.id ?? null,
			originRight: this.content[idx]?.id ?? null,
		});
		this.cursor++;
	}

	insert(text: string): void {
		const content = [...text];
		for (const c of content) this.insertOne(c, this.cursor);
		this.emitChangeEvent();
	}

	// Positive = delete forwards, negative = delete backwards
	delete(len = 1): void {
		if (len === 0) return;

		const inc = len > 0 ? 1 : -1;
		for (let i = 0; i < Math.abs(len); i++) {
			this.cursor += inc;
			const idx = this.findItem(this.cursor, false);
			this.content[idx].deleted = true;
		}
		this.emitChangeEvent();
	}

	private findItemIndex(id: Id | null): number {
		return this.content.findIndex((c) => idEq(c.id, id));
	}

	private integrate(newItem: Item): void {
		const [agent, seq] = newItem.id;
		const lastSeen = this.version[agent] ?? -1;
		if (seq !== lastSeen + 1) throw Error("Operations out of order");

		this.version[agent] = seq;

		const left = this.findItemIndex(newItem.originLeft);
		let destIdx = left + 1;
		const right =
			newItem.originRight == null
				? this.content.length
				: this.findItemIndex(newItem.originRight);
		let scanning = false;

		for (let i = destIdx; ; i++) {
			if (!scanning) destIdx = i;
			if (i === this.content.length) break;
			if (i === right) break;

			const other = this.content[i];

			const oleft = this.findItemIndex(other.originLeft) ?? -1;
			const oright =
				other.originRight == null
					? this.content.length
					: this.findItemIndex(other.originRight);

			if (
				oleft < left ||
				(oleft === left && oright === right && newItem.id[0] < other.id[0])
			)
				break;
			if (oleft === left) scanning = oright < right;
		}

		this.content.splice(destIdx, 0, newItem);
	}

	merge(other: Doc): void {
		const missing: (Item | null)[] = other.content.filter(
			(item) => !isInVersion(item.id, this.version),
		);
		let remaining = missing.length;

		while (remaining > 0) {
			let merged = 0;

			for (let i = 0; i < missing.length; i++) {
				const item = missing[i];
				if (item == null || !this.canInsert(item)) continue;

				this.integrate(item);
				missing[i] = null;
				remaining--;
				merged++;
			}

			if (merged === 0) throw Error("Not making progress");
		}

		let srcIdx = 0;
		let destIdx = 0;
		while (srcIdx < other.content.length) {
			const srcItem = other.content[srcIdx];
			let destItem = this.content[destIdx];

			while (!idEq(srcItem.id, destItem.id)) {
				destIdx++;
				destItem = this.content[destIdx];
			}

			if (srcItem.deleted) destItem.deleted = true;

			srcIdx++;
			destIdx++;
		}

		// TODO: proper checking
		this.emitChangeEvent();
	}

	private canInsert(item: Item): boolean {
		const [agent, seq] = item.id;
		return (
			!isInVersion(item.id, this.version) &&
			(seq === 0 || isInVersion([agent, seq - 1], this.version)) &&
			isInVersion(item.originLeft, this.version) &&
			isInVersion(item.originRight, this.version)
		);
	}

	getContent(): string {
		return this.content
			.filter((item) => !item.deleted)
			.map((item) => item.content)
			.join("");
	}

	reset(): void {
		this.content = [];
		this.version = {};
		this.emitChangeEvent();
	}

	private emitChangeEvent() {
		this.dispatchEvent(new CustomEvent("change"));
	}
}

function idEq(a: Id | null, b: Id | null): boolean {
	return a?.[0] === b?.[0] && a?.[1] === b?.[1];
}

function isInVersion(id: Id | null, version: Version): boolean {
	if (id == null) return true;
	const [agent, seq] = id;
	const highestSeq = version[agent];
	if (highestSeq == null) return false;

	return highestSeq >= seq;
}

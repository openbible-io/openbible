/** Accumulator for runs of Op<T>. Usually a string or array. */
export interface Accumulator<T> extends ArrayLike<T> {
	concat(...other: this[]): this;
	slice(start?: number, end?: number): this;
	/** For snapshot Array.slice(pos, 0, ...items) */
	[Symbol.iterator](): Iterator<T>;
}

/** The most important optimization. */
export interface Run {
	get length(): number;
	slice(start?: number, end?: number): this;
	/** Return undefined if cannot concatenate. */
	concat(other: this): this | undefined;
}

export class Insertion<T> implements Run {
	constructor(
		public pos: number,
		public items: Accumulator<T>,
	) {}

	get length() {
		return this.items.length;
	}

	slice(start?: number, end?: number) {
		start ??= 0;
		return new Insertion<T>(this.pos + start, this.items.slice(start, end)) as this;
	}

	concat(other: Insertion<T>) {
		if (other.pos === this.pos + this.length) {
			this.items = this.items.concat(other.items);
			return this;
		}
	}
}

export class Deletion implements Run {
	constructor(
		public pos: number,
		/** Negative means backwards, positive means forwards. */
		public count: number,
	) {}

	get length() {
		return Math.abs(this.count);
	}

	slice(start?: number, end?: number) {
		start ??= 0;
		if (this.count > 0) {
			// xxxxxx
			// p s  e
			// o t  n
			// s a  d
			//   r
			//   t
			return new Deletion(this.pos + start, (end ?? this.count) - start) as this;
		}
		// xxxxxx
		// s  e p
		// t  n o
		// a  d s
		// r
		// t
		const pos = end ?? this.pos;
		return new Deletion(pos, pos - start) as this;
	}

	concat(cur: Deletion) {
		if (
			(this.count > 0 && this.pos === cur.pos) ||
			(this.count < 0 && this.pos === cur.pos + this.count)
		) {
			this.count += (cur as Deletion).count;
			return this;
		}
	}
}

/** Intent of author when editing. */
export type Op<T> = Insertion<T> | Deletion;

/** Non-negative integer always incremented by each operation's length. */
export type Clock = number;

/** A unique Id per-editor. */
export type ReplicaId = string;

/** Unique identifier for an op. */
export type OpId = {
	/** Who wrote it */
	replica: ReplicaId;
	/** When they wrote it */
	clock: Clock;
};

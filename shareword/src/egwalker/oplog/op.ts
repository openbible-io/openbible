/** Accumulator for runs of Op<T>. May NOT == number. */
export interface Accumulator<T> extends ArrayLike<T> {
	slice(start?: number, end?: number): this;
	/** For snapshot Array.slice(pos, 0, ...items) */
	[Symbol.iterator](): Iterator<T>;
}

export type Insertion<T> = {
	type: "insertion";
	pos: number;
	item: T;
};
export type Deletion = {
	type: "deletion";
	pos: number;
	/** Negative means backwards, positive means forwards. */
	count: number;
};

/** Intent of author when typing. */
export type Op<T, AccT extends Accumulator<T>> =
	| Insertion<AccT>
	| Deletion;

/** Non-negative integer always incremented by each operation's length. */
export type Clock = number;

/** A unique Id per-editor. */
export type ReplicaId = string;

/** Unique identifier for an op. */
export type OpId = {
	replica: ReplicaId;
	clock: Clock;
};

/** Non-negative integer incremented after each operation. */
export type Clock = number;

/** A replica identifier. */
export type Site = string;

/** Unique identifier for an op. */
export type OpId = {
	site: Site;
	/** Local to originating site */
	siteClock: Clock;
};
export function opIdSlice(opId: OpId, start?: number, end?: number): OpId {
	return {
		site: opId.site,
		siteClock: opId.siteClock + (start ?? 0) - (end ?? 0),
	};
}

/** Supported text operations. */
export enum OpType {
	Insertion = 1, // string
	Deletion = 2, // -number
	Seek = 3, // number
}

/** A full operation and metadata to resolve it conflict-free. */
export interface Op<T> extends OpId {
	position: number; // TODO: remove
	data: T | number;
	parents: Clock[];
}

/** Accumulator for runs of Op<T>. May NOT == number. */
export interface Accumulator<T> extends ArrayLike<T> {
	slice(start?: number, end?: number): this;
	/** For snapshot Array.slice(pos, 0, ...items) */
	[Symbol.iterator](): Iterator<T>;
}

/** A run of Op<T>. */
export interface OpRun<T, AccT extends Accumulator<T>> extends OpId {
	position: number; // TODO: remove
	/** Insertion UTF-16 | deleteCount (negative) | seekPos (positive) */
	data: AccT | number;
	parents: Clock[];
}

// We could make various `Op` classes with nice functions, but it has a
// non-zero overhead compared to primitives and the whole point of the OpLog
// is to store a lot of these things.
export type OpData<T, AccT extends Accumulator<T>> = OpRun<T, AccT>["data"];

export function opType(data: OpData<any, any>): OpType {
	if (typeof data === "number") return data < 0 ? OpType.Deletion : OpType.Seek;
	return OpType.Insertion;
}

export function opLength<T, AccT extends Accumulator<T>>(
	data: OpData<T, AccT>,
): number {
	switch (opType(data)) {
		case OpType.Insertion:
			return (data as AccT).length;
		case OpType.Deletion:
			return -data;
		default:
			return 1;
	}
}

export function opSlice<T, AccT extends Accumulator<T>>(
	data: OpData<T, AccT>,
	start?: number,
	end?: number,
): OpData<T, AccT> {
	switch (opType(data)) {
		case OpType.Insertion:
			return (data as AccT).slice(start, end);
		case OpType.Deletion:
			return (data as number) + (start ?? 0);
		default:
			return data;
	}
}

export function opMerge<T, AccT extends Accumulator<T>>(
	mergeFn: (acc: AccT, cur: AccT) => AccT,
	lhs: OpData<T, AccT>,
	rhs: OpData<T, AccT>,
): OpData<T, AccT> | undefined {
	const ty = opType(lhs);
	if (ty !== opType(rhs)) return;

	switch (ty) {
		case OpType.Insertion:
			return mergeFn(lhs as AccT, rhs as AccT);
		case OpType.Deletion:
			return (lhs as number) + (rhs as number);
		default:
			return lhs as number; // overwrite previous seek
	}
}

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

/** Supported text operations. */
export enum OpType {
	Insertion = 1, // string
	Deletion = 2, // -number
	Seek = 3, // number
}

/** A full operation and metadata to resolve it conflict-free. */
export interface Op<T> extends OpId {
	data: T | number;
	parents: Clock[];
}

/** Accumulator for runs of Op<T> */
export interface Accumulator<T> extends ArrayLike<T> {
	slice(start?: number, end?: number): this;
	concat(other: this): this;
	//[Symbol.iterator](): Iterator<T>;
}

/** A run of Op<T>. */
export interface OpRun<T, AccT extends Accumulator<T>> extends OpId {
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

export function opLength<T, AccT extends Accumulator<T>>(data: OpData<T, AccT>): number {
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
	lhs: OpData<T, AccT>,
	rhs: OpData<T, AccT>,
): OpData<T, AccT> | undefined {
	const ty = opType(lhs);
	if (ty !== opType(rhs)) return;

	switch (ty) {
		case OpType.Insertion:
			return (lhs as AccT).concat(rhs as AccT);
		case OpType.Deletion:
			return (lhs as number) + (rhs as number);
		default:
			return lhs as number; // overwrite previous seek
	}
}

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

export interface OpSliceable<T, AccT extends Accumulator<T>> extends OpId {
	position: number;
	data: OpData<T, AccT>;
}

export function opSlice<T, AccT extends Accumulator<T>>(
	op: OpSliceable<T, AccT>,
	start?: number,
	end?: number,
): OpSliceable<T, AccT> {
	const res = {...op};
	start ??= 0;
	res.siteClock += start;
	switch (opType(op.data)) {
		case OpType.Insertion:
			res.data = (res.data as AccT).slice(start, end);
			res.position += start;
			break
		case OpType.Deletion:
			(res.data as number) += start;
			break;
		default:
			return op;
	}
	return res;
}

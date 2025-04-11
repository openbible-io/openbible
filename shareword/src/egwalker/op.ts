import { assert } from "./util";

/** Non-negative integer incremented after each operation. */
export type Clock = number;

/** A replica identifier. */
export type Site = string;

/** Unique identifier for an op. */
export type OpId = {
	site: Site;
	siteClock: Clock;
};
export function opIdSlice(opId: OpId, start?: number, end?: number): OpId {
	return {
		site: opId.site,
		siteClock: opId.siteClock + (start ?? 0) - (end ?? 0),
	};
}

export type OpRef = number;
export const maxRunLen = 256;
export function refEncode(idx: number, offset = 0): OpRef {
	return (idx << 8) + offset;
}
export function refDecode(ref: OpRef): [idx: number, offset: number] {
	return [ref >> 8, ref & 0xff];
}

/** Supported text operations. */
export enum OpType {
	Insertion = 1, // string
	Deletion = 2, // -number
}

/** Accumulator for runs of Op<T>. May NOT == number. */
export interface Accumulator<T> extends ArrayLike<T> {
	slice(start?: number, end?: number): this;
	/** For snapshot Array.slice(pos, 0, ...items) */
	[Symbol.iterator](): Iterator<T>;
}

export interface OpRun<T, AccT extends Accumulator<T>> extends OpId {
	position: number;
	/** Insertion UTF-16 | deleteCount (negative) | seekPos (positive) */
	data: AccT | number;
}

// We could make various `Op` classes with nice functions, but it has a
// non-zero overhead compared to primitives and the whole point of the OpLog
// is to store a lot of these things.
export type OpData<T, AccT extends Accumulator<T>> = OpRun<T, AccT>["data"];

export function opType(data: OpData<any, any>): OpType {
	if (typeof data === "number") {
		assert(data < 0, `non-positive op ${data}`);
		return OpType.Deletion;
	}
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

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

/**
 * There are 52 fraction bits in a `number` (Float64).
 * However, JS only allows array indices up to 2^32, which is what the run
 * index represents.
 *
 * Note: SMI deoptimization begins at 2^32-1.
 *
 * High 32 bits = run index
 * Low 8 bits = run offset
 */
export type OpRef = number;
/**
 * Every part of every operation must be referable in order to determine
 * causality and automatically merge. Additionally, that reference must be
 * serializable so that it can be sent as a `Patch` to other `Site`s.
 *
 * Since we do a lot of graph operations to determine causality, it's
 * preferable that such a reference fit in a single small integer that our JS
 * engine can store in an SMI. For that reason, we limit the length of runs so
 * that we can use the lower bits to represent offsets.
 */
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

// We could make an `Op` class with optional members and nice functions, but
// primitives are smaller and faster.
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

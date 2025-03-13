import { MultiArrayList } from "./util/multi-array-list";
import { Rle } from "./util/rle";

/** A collaborating agent */
export type Site = string;
/**
 * Non-negative integer incremented after each operation.
 * Lamport timestamp.
 */
export type Clock = number;
/** Each UTF-16 code unit is assigned this */
export type Id = { site: Site; clock: Clock };

export type Op<T> = {
	id: Id;
	parents: Clock[];

	pos: number;
	delCount: number;
	content: T;
};

type RleOp<ArrT> = {
	id: Id;
	position: number;
	deleteCount: number;
	items: ArrT;
};

/**
 * An oplog optimized to use less memory
 * @param T The item type.
 * @param ArrT The container to use for runs of items.
 */
export class RleOpLog<T, ArrT extends ArrayLike<T>> {
	// We have a lot of choices of how to encode Ops. Run length is a natural
	// choice because people usually type in runs.
	//
	// Each run requires extra metadata for its range, which we'd like to
	// minimize. We could encode everything as a run, but parents will require
	// new runs whenever there is concurrency. For that reason we separate them
	// out.
	ops: Rle<RleOp<ArrT>, MultiArrayList<RleOp<ArrT>>>;
	opsParents: Rle<Clock[]>;

	constructor(
		private emptyElement: ArrT,
		mergeFn: (acc: ArrT, cur: ArrT) => ArrT,
	) {
		this.ops = new Rle(
			new MultiArrayList({
				id: { site: "", clock: 0 },
				position: 0,
				deleteCount: 0,
				items: emptyElement,
			}),
			(items, cur, lastRange) => {
				const curLen = cur.items.length;
				if (!lastRange) return { curLen, appended: false };

				const prevPos = last(items.fields.position);
				const prevDelCount = last(items.fields.deleteCount);
				const prevId = last(items.fields.id);
				const prevLength = lastRange.len;

				if (
					prevId.site !== cur.id.site ||
					prevId.clock + prevLength !== cur.id.clock
				)
					return { curLen, appended: false };

				if (
					!prevDelCount &&
					!cur.deleteCount &&
					prevPos + prevLength === cur.position
				) {
					items.fields.items[items.fields.items.length - 1] = mergeFn(
						items.fields.items[items.fields.items.length - 1],
						cur.items,
					);
					return { curLen, appended: true };
				}

				if (prevDelCount && cur.deleteCount && prevPos === cur.position) {
					items.fields.deleteCount[items.length - 1] += cur.deleteCount;
					return { curLen, appended: true };
				}

				return { curLen, appended: false };
			},
		);
		this.opsParents = new Rle<Clock[]>([], (items, cur) => {
			const curLen = 1;
			const lastParents: Clock[] | undefined = items[items.length - 1];
			if (
				cur.length === 1 &&
				lastParents &&
				lastParents.length === 1 &&
				lastParents[0] + 1 === cur[0]
			) {

				return { curLen, appended: true };
			}

			return { curLen, appended: false };
		});
	}

	getId(lc: Clock): Id {
		const { idx, offset } = this.ops.offsetOf(lc);
		const res = { ...this.ops.items.fields.id[idx] };
		res.clock += offset;
		return res;
	}

	getPos(lc: Clock): number {
		let { idx, offset } = this.ops.offsetOf(lc);
		if (this.ops.items.fields.deleteCount[idx]) offset = 0;
		return this.ops.items.fields.position[idx] + offset;
	}

	getDeleteCount(lc: Clock): number {
		const { idx } = this.ops.offsetOf(lc);
		return this.ops.items.fields.deleteCount[idx];
	}

	getContent(lc: Clock): T {
		const { idx, offset } = this.ops.offsetOf(lc);
		return this.ops.items.fields.items[idx][offset];
	}

	getParents(lc: Clock): Clock[] {
		const { idx, offset } = this.opsParents.offsetOf(lc);
		const parents: Clock[] | undefined = this.opsParents.items[idx];
		console.dir(this.opsParents);
		console.log({ lc, idx, offset, parents });
		if (offset) return [(parents?.[0] ?? -1) + offset];
		return parents;
	}

	nextClock() {
		return this.ops.length;
	}

	push(
		id: Id,
		parents: Clock[],
		position: number,
		deleteCount: number,
		items: ArrT = this.emptyElement,
	): void {
		this.ops.push({
			id,
			position,
			deleteCount,
			items,
		});
		this.opsParents.push(parents);
	}

	get length(): number {
		return this.ops.length;
	}
}

function last<T>(arr: T[]) {
	return arr[arr.length - 1];
}

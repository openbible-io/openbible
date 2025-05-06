import { Rle } from "../util";
import type { Accumulator, Deletion, Insertion, Op, Seek } from "./op";


export class Replica<T, AccT extends Accumulator<T>> extends Rle<Op<T, AccT>> {
	constructor(mergeFn: (acc: AccT, cur: AccT) => AccT) {
		super(
			[],
			(ctx, item) => {
				const last = ctx.items[ctx.items.length - 1];
				if (last.type !== item.type) return false;
				switch (last.type) {
					case "insertion":
						last.item = mergeFn(last.item, (item as Insertion<AccT>).item);
						break;
					case "deletion":
						if (last.dir !== (item as Deletion).dir) return false;
						last.count += (item as Deletion).count;
						break;
					case "seek":
						last.pos = (item as Seek).pos;
						break;
				}
				return true;
			},
		);
	}

	override push(op: Op<T, AccT>) {
		return super.push(op, opLength(op));
	}
}

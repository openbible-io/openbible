import { advanceFrontier, type OpLog } from "./oplog";
import { EgWalker, State, type Item } from "./egwalker";
import type { Accumulator, Clock } from "./oplog-rle";
import { ListSnapshot } from "./snapshot";

export class Branch<T, AccT extends Accumulator<T>> extends ListSnapshot<T> {
	frontier: Clock[] = [];

	checkout(oplog: OpLog<T, AccT>, mergeFrontier: Clock[] = oplog.frontier) {
		const { head, shared, bOnly } = oplog.diffBetween2(
			this.frontier,
			mergeFrontier,
		);

		const doc = new EgWalker(oplog);
		doc.currentVersion = head;

		const placeholderLength = Math.max(...this.frontier) + 1;
		const placeholderOffset = oplog.length; // @seph: is this correct?
		for (let i = 0; i < placeholderLength; i++) {
			const item: Item = {
				clock: i + placeholderOffset,
				state: State.Inserted,
				deleted: false,
				originLeft: -1,
				originRight: -1,
			};
			doc.items.push(item);
			doc.targets[item.clock] = item;
		}

		for (const c of shared) doc.applyOp(c);
		for (const c of bOnly) {
			doc.applyOp(c, this);
			this.frontier = advanceFrontier(this.frontier, c, oplog.getParents(c));
		}
	}
}

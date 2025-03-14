import { advanceFrontier, type OpLog } from "./oplog";
import { EgWalker, State, type Item } from "./egwalker";
import type { Clock } from "./util/state-vector";
import type { Accumulator } from "./oplog-rle";

export class Branch<T, AccT extends Accumulator<T>> {
	snapshot: T[] = [];
	frontier: Clock[] = [];

	checkout(oplog: OpLog<T, AccT>, mergeFrontier: Clock[] = oplog.frontier) {
		const { head, shared, bOnly } = oplog.diff2(
			this.frontier,
			mergeFrontier,
		);

		const doc = new EgWalker<T, AccT>();
		doc.currentVersion = head;

		const placeholderLength = Math.max(...this.frontier) + 1;
		const placeholderOffset = oplog.length;
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

		for (const c of shared) doc.doOp(oplog, c);
		for (const c of bOnly) {
			doc.doOp(oplog, c, this.snapshot);
			this.frontier = advanceFrontier(this.frontier, c, oplog.getParents(c));
		}
	}
}

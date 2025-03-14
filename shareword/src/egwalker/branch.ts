import { advanceFrontier, type OpLog } from "./oplog";
import { EgWalker, State, type Item } from "./egwalker";
import type { Clock } from "./util/state-vector";

export class Branch<T, ArrT extends ArrayLike<T>> {
	snapshot: T[] = [];
	frontier: Clock[] = [];

	checkout(oplog: OpLog<T, ArrT>, mergeFrontier: Clock[] = oplog.frontier) {
		const { head, shared, bOnly } = oplog.diff2(
			this.frontier,
			mergeFrontier,
		);

		const doc = new EgWalker<T, ArrT>();
		doc.currentVersion = head;

		const placeholderLength = Math.max(...this.frontier) + 1;
		const placeholderOffset = oplog.nextClock();
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
